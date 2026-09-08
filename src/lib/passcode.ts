"use client";

// Offline passcode access.
//
// Lets a user sign in WHILE OFFLINE using a short numeric passcode, without a
// live Supabase server session. The passcode is the gate that lets the app
// render from its cached offline data (Dexie) and keeps a shared terminal from
// leaking one cashier's session to another.
//
// Security model:
//  - The passcode is never stored in plaintext. It is hashed with PBKDF2
//    (WebCrypto) + a random per-user salt.
//  - A small encrypted "vault" (email + password) is stored so the app can
//    silently re-establish the REAL server session when the device comes back
//    online. The vault is encrypted with a key derived from the passcode, so
//    it is unreachable without the passcode.
//  - A signed "offline session" browser signal lets middleware allow navigation
//    into the app shell while offline. It does NOT grant data access — the real
//    server APIs still reject without a live session (offline reads come from
//    the local Dexie cache).

import { readUserContext } from "@/lib/offline/user-context";
import {
  authorizeOfflineSessionSignal,
  expireOfflineSessionSignal,
  isOfflineSessionAuthorized,
} from "@/lib/offline/session-signal";

const PASSCODE_KEY = "mediflow_passcode_v1";
const VAULT_KEY = "mediflow_passcode_vault_v1";
const REAUTH_KEY = "mediflow_reauth_token";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const VAULT_IV_LENGTH = 12;

interface PasscodeRecord {
  salt: string; // base64
  hash: string; // base64
  attempts: number;
  locked_until?: number; // epoch ms
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function pbkdf2(password: string, saltB64: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: b64ToBuf(saltB64),
      iterations: 100_000,
    },
    keyMaterial,
    256
  );
  return bufToB64(bits);
}

function randomB64(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return bufToB64(buf.buffer);
}

function readRecord(): PasscodeRecord | null {
  try {
    const raw = window.localStorage.getItem(PASSCODE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PasscodeRecord;
  } catch {
    return null;
  }
}

function writeRecord(rec: PasscodeRecord): void {
  window.localStorage.setItem(PASSCODE_KEY, JSON.stringify(rec));
}

/** True once the user on this device has a configured passcode. */
export function hasPasscode(): boolean {
  return readRecord() !== null;
}

/** True when the dev has a configured passcode AND a matching cached user context. */
export function canSignInOffline(): boolean {
  return hasPasscode() && readUserContext() !== null;
}

/**
 * Configure a new passcode (or replace an existing one). Must be exactly 4
 * digits. Also (re)encrypts the credential vault with the new passcode.
 */
export async function setPasscode(
  email: string,
  password: string | null | undefined,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  if (!/^\d{4}$/.test(code)) {
    return { ok: false, error: "Passcode must be exactly 4 digits." };
  }
  const salt = randomB64(16);
  const hash = await pbkdf2(code, salt);
  writeRecord({ salt, hash, attempts: 0 });
  // Re-encrypt the credential vault (kept in lock-step with the passcode).
  if (email && password) {
    await encryptVault(email, password, code);
  }
  return { ok: true };
}

export async function verifyPasscode(
  code: string
): Promise<{ ok: boolean; error?: string; email?: string; password?: string }> {
  const rec = readRecord();
  if (!rec) return { ok: false, error: "No passcode configured." };

  if (rec.locked_until && Date.now() < rec.locked_until) {
    const mins = Math.ceil((rec.locked_until - Date.now()) / 60_000);
    return { ok: false, error: `Too many attempts. Try again in ${mins} min.` };
  }

  const hash = await pbkdf2(code, rec.salt);
  if (hash !== rec.hash) {
    const attempts = rec.attempts + 1;
    const next: PasscodeRecord = { ...rec, attempts };
    if (attempts >= MAX_ATTEMPTS) {
      next.locked_until = Date.now() + LOCKOUT_MS;
      next.attempts = 0;
    }
    writeRecord(next);
    return { ok: false, error: "Incorrect passcode." };
  }

  writeRecord({ ...rec, attempts: 0, locked_until: undefined });
  const creds = await decryptVault(code);
  return { ok: true, email: creds?.email, password: creds?.password };
}

export function clearPasscode(): void {
  try {
    window.localStorage.removeItem(PASSCODE_KEY);
    window.localStorage.removeItem(VAULT_KEY);
    window.localStorage.removeItem(REAUTH_KEY);
    expireOfflineSessionSignal();
  } catch {
    /* ignore */
  }
}

// --- Re-auth token (silent online refresh) --------------------------------------

/**
 * Store the current user's email + Supabase refresh token so the app can, when
 * it comes back online with no live session (offline passcode mode), silently
 * re-establish the REAL server session via setSession — no password prompt, no
 * data loss. Overwritten on each login so it never points at a stale user.
 */
export function storeReauthToken(refresh_token: string, email: string): void {
  try {
    window.localStorage.setItem(
      REAUTH_KEY,
      JSON.stringify({ email: email.trim().toLowerCase(), refresh_token })
    );
  } catch {
    /* ignore */
  }
}

export function readReauthToken(): { email: string; refresh_token: string } | null {
  try {
    const raw = window.localStorage.getItem(REAUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; refresh_token?: string };
    if (parsed && parsed.email && parsed.refresh_token) {
      return { email: parsed.email, refresh_token: parsed.refresh_token };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearReauthToken(): void {
  try {
    window.localStorage.removeItem(REAUTH_KEY);
  } catch {
    /* ignore */
  }
}

// --- Encrypted credential vault -------------------------------------------------

async function deriveVaultKey(code: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(`mediflow-vault:${code}`),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode("mediflow-vault-salt"), iterations: 150_000 },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptVault(
  email: string,
  password: string,
  code: string
): Promise<boolean> {
  try {
    const key = await deriveVaultKey(code);
    const iv = crypto.getRandomValues(new Uint8Array(VAULT_IV_LENGTH));
    const enc = new TextEncoder();
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(JSON.stringify({ email, password }))
    );
    const combined = new Uint8Array(iv.length + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.length);
    window.localStorage.setItem(VAULT_KEY, bufToB64(combined.buffer));
    return true;
  } catch {
    return false;
  }
}

async function decryptVault(
  code: string
): Promise<{ email: string; password: string } | null> {
  try {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const combined = new Uint8Array(b64ToBuf(raw));
    const iv = combined.slice(0, VAULT_IV_LENGTH);
    const cipher = combined.slice(VAULT_IV_LENGTH);
    const key = await deriveVaultKey(code);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      cipher
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain));
    if (parsed && parsed.email) return parsed as { email: string; password: string };
    return null;
  } catch {
    return null;
  }
}

// --- Offline session signal -----------------------------------------------------
// Delegated to src/lib/offline/session-signal.ts (shared with logout.ts).

/** Marks this device as passcode-authorized for offline use (survives page loads). */
export function authorizeOfflineSession(): void {
  authorizeOfflineSessionSignal();
}

export { isOfflineSessionAuthorized };
