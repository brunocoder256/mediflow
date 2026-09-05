import { NextResponse } from 'next/server';

// Lightweight reachability endpoint used by the client online/offline probe.
// Must stay tiny and dependency-free so it responds even under load.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() });
}