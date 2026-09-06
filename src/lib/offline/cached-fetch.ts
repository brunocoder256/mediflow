"use client";

// Generic offline read-cache helper.
//
// `cachedFetch` behaves like `fetch(...).then(r => r.json())` when online and
// transparently stores the parsed JSON in IndexedDB (dataCache table) keyed by
// the normalized request URL. When the network is unreachable, it falls back to
// the most recently cached snapshot so daily pages keep rendering with last
// known data.
//
// Only GET requests are cached. Write endpoints must NOT go through this helper
// (they keep using the offline write-queue in sync.ts).

import { db, type DataCacheEntry } from "./db";

const KNOWN_GET_METHOD = "GET";

function normalizeUrl(input: string): string {
  return input;
}

export async function cachedFetch<T = unknown>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const url = normalizeUrl(input);
  const isGet = !init || (init.method ?? KNOWN_GET_METHOD).toUpperCase() === KNOWN_GET_METHOD;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cached = await readCache<T>(url);
    if (cached !== undefined) return cached;
    throw new Error("Offline and no cached copy available");
  }

  try {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const data: unknown = await res.json();
    if (isGet) {
      await writeCache(url, data);
    }
    return data as T;
  } catch (err) {
    if (isGet) {
      const cached = await readCache<T>(url);
      if (cached !== undefined) return cached;
    }
    throw err;
  }
}

async function readCache<T>(url: string): Promise<T | undefined> {
  try {
    const entry = await db.dataCache.where("url").equals(url).first();
    return entry ? (entry.payload as T) : undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(url: string, payload: unknown): Promise<void> {
  try {
    const existing = await db.dataCache.where("url").equals(url).first();
    const data: DataCacheEntry = {
      id: existing?.id ?? crypto.randomUUID(),
      url,
      payload,
      cached_at: new Date().toISOString(),
    };
    await db.dataCache.put(data);
  } catch {
    // cache write failures should never break the live request
  }
}

export async function readCached<T = unknown>(url: string): Promise<T | undefined> {
  return readCache<T>(normalizeUrl(url));
}

export async function invalidateCache(urlPrefix: string): Promise<void> {
  try {
    const all = await db.dataCache.toArray();
    const toDelete = all.filter((e) => e.url.startsWith(urlPrefix));
    await db.dataCache.bulkDelete(toDelete.map((e) => e.id));
  } catch {
    // ignore
  }
}
