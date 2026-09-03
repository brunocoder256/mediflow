import { NextResponse } from 'next/server';
import { getCashRegisters, createCashRegister } from '@/lib/services/cash';
export async function GET(req: Request) {
  const branch_id = new URL(req.url).searchParams.get('branch_id') ?? undefined;
  const data = await getCashRegisters(branch_id);
  return NextResponse.json(data);
}
export async function POST(req: Request) {
  try { const body = await req.json(); const data = await createCashRegister(body); return NextResponse.json(data); } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
