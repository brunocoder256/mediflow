import { NextResponse } from 'next/server';
import { getCashRegisters } from '@/lib/services/cash';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('registers') === '1') {
      const data = await getCashRegisters(searchParams.get('branch_id') ?? undefined);
      return NextResponse.json(data);
    }
    return NextResponse.json([]);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}