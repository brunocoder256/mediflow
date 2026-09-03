import { NextResponse } from 'next/server';
import { getSB } from '@/lib/services/supabase';

export async function GET(req: Request){
  try{
    const sb:any = await getSB();
    const _branch_id = new URL(req.url).searchParams.get('branch_id') ?? undefined;
    const q = sb.from('suppliers').select('id, name, phone, email, is_active').eq('is_active', true).order('name');
    const {data, error} = await q;
    if(error) throw new Error(error.message);
    // also compute balances for each supplier via rpc
    const enriched = await Promise.all((data??[]).map(async (s:any)=>{
      try{
        const {data: bal}=await sb.rpc('get_supplier_balance', {p_supplier_id: s.id, p_org_id: (await getOrgId())});
        return {...s, balance: bal?.[0]?.balance ?? 0};
      }catch{ return {...s, balance:0};}
    }));
    return NextResponse.json(enriched);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500});}
}
async function getOrgId(){ const sb:any=await getSB(); const {data:{user}}=await sb.auth.getUser(); const {data}=await sb.from('profiles').select('organization_id').eq('auth_user_id', user.id).single(); return data?.organization_id; }

export async function POST(req: Request){
  try{
    const body=await req.json();
    const sb:any=await getSB();
    const {data:{user}}=await sb.auth.getUser();
    const {data: prof}=await sb.from('profiles').select('organization_id').eq('auth_user_id', user.id).single();
    const {data, error}=await sb.from('suppliers').insert({ organization_id: prof.organization_id, name: body.name, phone: body.phone ?? null, email: body.email ?? null, is_active: true }).select().single();
    if(error) throw new Error(error.message);
    return NextResponse.json(data,{status:201});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400});}
}
