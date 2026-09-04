import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { listCustomers, getCustomerKPIs, createCustomer, checkDuplicates } from '@/lib/services/customers';

export async function GET(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const kpi = searchParams.get('kpi');
    if(kpi==='1'){
      const branch_id = searchParams.get('branch_id') ?? undefined;
      const data = await getCustomerKPIs(branch_id);
      return NextResponse.json(data);
    }
    // duplicate check shortcut
    const dupCheck = searchParams.get('check');
    if(dupCheck==='1'){
      const phone = searchParams.get('phone') ?? undefined;
      const email = searchParams.get('email') ?? undefined;
      const name = searchParams.get('name') ?? undefined;
      const customer_code = searchParams.get('customer_code') ?? undefined;
      const dups = await checkDuplicates({ phone, email, name, customer_code });
      return NextResponse.json(dups);
    }
    const search = searchParams.get('search') ?? searchParams.get('q') ?? undefined;
    const customer_type = searchParams.get('customer_type') ?? undefined;
    const status = searchParams.get('status') ?? undefined;
    const branch_id = searchParams.get('branch_id') ?? undefined;
    const credit_status = searchParams.get('credit_status') as any ?? undefined;
    const date_from = searchParams.get('date_from') ?? undefined;
    const date_to = searchParams.get('date_to') ?? undefined;
    const page = parseInt(searchParams.get('page') ?? '1');
    const perPage = parseInt(searchParams.get('perPage') ?? '20');
    // support legacy limit param
    const legacyLimit = searchParams.get('limit');
    const finalPerPage = legacyLimit ? parseInt(legacyLimit) : perPage;
    // if simple search without pagination (POS fast search) - keep backwards compatible array response
    const isSimpleSearch = search && !searchParams.get('page') && !searchParams.get('customer_type') && !searchParams.get('status') && !searchParams.get('branch_id');
    const res = await listCustomers({ search, customer_type, status, branch_id, credit_status, date_from, date_to, page, perPage: finalPerPage });
    if(isSimpleSearch){
      // POS expects array directly for backwards compatibility
      return NextResponse.json(res.data ?? []);
    }
    return NextResponse.json(res);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500}); }
}

const CreateSchema=z.object({
  name: z.string().min(1).max(100).optional(),
  display_name: z.string().max(100).optional(),
  company_name: z.string().max(100).optional(),
  first_name: z.string().max(50).optional().nullable(),
  last_name: z.string().max(50).optional().nullable(),
  customer_type: z.string().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  alternate_phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(50).optional().nullable(),
  branch_id: z.string().uuid().optional().nullable().or(z.literal('')),
  external_reference: z.string().max(50).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  credit_limit: z.number().optional().nullable().or(z.string().transform(v=> Number(v)||0)),
  payment_terms: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  preferred_contact: z.string().optional().nullable(),
  sms_opt_in: z.boolean().optional().nullable(),
  email_opt_in: z.boolean().optional().nullable(),
  marketing_opt_in: z.boolean().optional().nullable(),
  contact_person: z.string().max(100).optional().nullable(),
  customer_code: z.string().max(30).optional().nullable(),
  continue_anyway: z.boolean().optional(),
});

export async function POST(req: Request){
  try{
    const body=await req.json();
    // allow raw name/phone/email quick create from POS
    if(body.check_only){
      const dups = await checkDuplicates({ phone: body.phone, email: body.email, name: body.name ?? body.display_name, customer_code: body.customer_code, company_name: body.company_name });
      return NextResponse.json({ duplicates: dups });
    }
    const parsed=CreateSchema.parse(body);
    // at least one name field required
    if(!parsed.name && !parsed.display_name && !parsed.company_name){
      return NextResponse.json({error:'Name or company name required'},{status:400});
    }
    // duplicate detection before creating, unless continue_anyway
    if(!parsed.continue_anyway){
      const dups = await checkDuplicates({ phone: parsed.phone ?? undefined, email: parsed.email ?? undefined, name: parsed.name ?? parsed.display_name ?? undefined, customer_code: parsed.customer_code ?? undefined, company_name: parsed.company_name ?? undefined });
      if(dups.length>0){
        return NextResponse.json({ error: 'A similar customer already exists.', duplicates: dups, duplicate_detected:true }, { status: 409 });
      }
    }
    const res = await createCustomer(parsed);
    // if duplicates found after create, include warning
    if(res.duplicates && res.duplicates.length>0 && !parsed.continue_anyway){
      // we already blocked above, but if continue_anyway false this won't happen
    }
    return NextResponse.json(res.customer,{status:201});
  }catch(e:any){
    if(e.name==='ZodError') return NextResponse.json({error:'Validation failed', issues:e.issues},{status:400});
    if(e.message?.includes('similar customer')) return NextResponse.json({error:e.message},{status:409});
    return NextResponse.json({error:e.message, issues:e.issues},{status:400});
  }
}

export async function PATCH(req: Request){
  try{
    const body=await req.json();
    const { id, action, ...patch }=body;
    if(!id) return NextResponse.json({error:'id required'},{status:400});
    const { updateCustomer, deactivateCustomer, reactivateCustomer, blockCustomer, deleteCustomerHard } = await import('@/lib/services/customers');
    if(action==='deactivate') {
      const data=await deactivateCustomer(id, patch.reason);
      return NextResponse.json(data);
    }
    if(action==='reactivate') {
      const data=await reactivateCustomer(id);
      return NextResponse.json(data);
    }
    if(action==='block') {
      const data=await blockCustomer(id, patch.reason);
      return NextResponse.json(data);
    }
    if(action==='unblock') {
      const data=await reactivateCustomer(id);
      return NextResponse.json(data);
    }
    if(action==='delete') {
      await deleteCustomerHard(id);
      return NextResponse.json({success:true});
    }
    const data=await updateCustomer(id, patch);
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400}); }
}

export async function DELETE(req: Request){
  try{
    const { searchParams } = new URL(req.url);
    const id=searchParams.get('id');
    if(!id) return NextResponse.json({error:'id required'},{status:400});
    const { deleteCustomerHard } = await import('@/lib/services/customers');
    await deleteCustomerHard(id);
    return NextResponse.json({success:true});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400}); }
}
