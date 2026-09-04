import { NextResponse } from 'next/server';
import { getSuppliers, createSupplier, getSupplierDetail, updateSupplier, deleteSupplier, getSupplierStatement, setSupplierStatus, getSupplierPriceHistory, addSupplierNote, addSupplierDocument, linkSupplierProduct, unlinkSupplierProduct } from '@/lib/services/suppliers';
import { getSB } from '@/lib/services/supabase';

export async function GET(req: Request){
  try{
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const detail = url.searchParams.get('detail');
    const statement = url.searchParams.get('statement');
    const priceHistory = url.searchParams.get('priceHistory');

    if(id && detail === '1'){
      const data = await getSupplierDetail(id);
      return NextResponse.json(data);
    }
    if(id && statement === '1'){
      const from = url.searchParams.get('from') ?? undefined;
      const to = url.searchParams.get('to') ?? undefined;
      const data = await getSupplierStatement(id, { from, to });
      return NextResponse.json(data);
    }
    if(id && priceHistory === '1'){
      const product_id = url.searchParams.get('product_id') ?? undefined;
      const data = await getSupplierPriceHistory(id, product_id ?? undefined);
      return NextResponse.json(data);
    }
    if(id){
      const sb:any = await getSB();
      const {data, error} = await sb.from('suppliers').select('*').eq('id', id).single();
      if(error) throw new Error(error.message);
      return NextResponse.json(data);
    }

    // list with server-side pagination/search
    const search = url.searchParams.get('search') ?? url.searchParams.get('q') ?? undefined;
    const supplier_type = url.searchParams.get('supplier_type') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const branch_id = url.searchParams.get('branch_id') ?? undefined;
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : undefined;
    const perPage = url.searchParams.get('perPage') ? Number(url.searchParams.get('perPage')) : undefined;
    const includeInactive = url.searchParams.get('includeInactive') === '1' || url.searchParams.get('all') === '1';

    const result = await getSuppliers({ search, supplier_type, status, branch_id, page, perPage, includeInactive });
    // support both array and paginated response
    if(page){
      return NextResponse.json(result);
    }
    // backward compat: return array
    return NextResponse.json(result.data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:500});}
}

export async function POST(req: Request){
  try{
    const body = await req.json();
    // detect sub-actions
    if(body.action === 'link_product'){
      const data = await linkSupplierProduct(body.payload);
      return NextResponse.json(data,{status:201});
    }
    if(body.action === 'unlink_product'){
      const ok = await unlinkSupplierProduct(body.id);
      return NextResponse.json({ok});
    }
    if(body.action === 'add_note'){
      const data = await addSupplierNote(body.supplier_id, body.note);
      return NextResponse.json(data,{status:201});
    }
    if(body.action === 'add_document'){
      const data = await addSupplierDocument(body.supplier_id, { file_name: body.file_name, file_url: body.file_url, file_size: body.file_size, mime_type: body.mime_type, document_type: body.document_type });
      return NextResponse.json(data,{status:201});
    }
    if(body.action === 'status'){
      const data = await setSupplierStatus(body.id, body.status);
      return NextResponse.json(data);
    }
    const data = await createSupplier(body);
    return NextResponse.json(data,{status:201});
  }catch(e:any){
    const msg = e?.message ?? 'Failed';
    const issues = (e as any)?.issues ?? (e as any)?.errors ?? undefined;
    return NextResponse.json({error: msg, issues},{status:400});
  }
}

export async function PATCH(req: Request){
  try{
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const body = await req.json();
    const targetId = id ?? body.id;
    if(!targetId) return NextResponse.json({error:'Missing id'},{status:400});
    if(body.status && Object.keys(body).length===1) {
      const data = await setSupplierStatus(targetId, body.status);
      return NextResponse.json(data);
    }
    const data = await updateSupplier(targetId, body);
    return NextResponse.json(data);
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400});}
}

export async function DELETE(req: Request){
  try{
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if(!id) return NextResponse.json({error:'Missing id'},{status:400});
    await deleteSupplier(id);
    return NextResponse.json({ok:true});
  }catch(e:any){ return NextResponse.json({error:e.message},{status:400});}
}
