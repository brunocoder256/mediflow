import { NextResponse } from 'next/server';
import { getSB, getProfileId } from '@/lib/services/supabase';
import { z } from 'zod/v4';

export async function GET(req: Request){
  try{
    const sb:any = await getSB();
    const q=new URL(req.url).searchParams;
    const search=q.get('search') ?? '';
    let builder=sb.from('customers').select('id, name, phone, email, notes, is_active, created_at').eq('is_active', true).order('name');
    if(search) builder=builder.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    const {data, error}=await builder.limit(50);
    if(error) throw new Error(error.message);
    return NextResponse.json(data ?? []);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}
const CreateSchema=z.object({ name: z.string().min(1).max(100), phone: z.string().max(20).optional().nullable(), email: z.string().email().optional().nullable().or(z.literal('')), notes: z.string().max(500).optional().nullable() });
export async function POST(req: Request){
  try{
    const body=await req.json();
    const parsed=CreateSchema.parse(body);
    const sb:any = await getSB();
    const {data:{user}}=await sb.auth.getUser();
    const {data: prof}=await sb.from('profiles').select('organization_id').eq('auth_user_id', user.id).single();
    const {data, error}=await sb.from('customers').insert({ organization_id: prof.organization_id, name: parsed.name, phone: parsed.phone ?? null, email: parsed.email || null, notes: parsed.notes ?? null, is_active:true }).select().single();
    if(error) throw new Error(error.message);
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message, issues:e.issues},{status:400}); }
}
export async function PATCH(req: Request){
  try{
    const {id, ...patch}=await req.json();
    const sb:any = await getSB();
    const {data, error}=await sb.from('customers').update(patch).eq('id', id).select().single();
    if(error) throw new Error(error.message);
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400}); }
}
