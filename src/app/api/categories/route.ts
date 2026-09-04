import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';

export async function GET() {
  try {
    const sb: any = await getSB();
    const { data, error } = await sb.from('categories').select('id, name, is_active').eq('is_active', true).order('name');
    if (error) throw new Error(error.message);
    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
