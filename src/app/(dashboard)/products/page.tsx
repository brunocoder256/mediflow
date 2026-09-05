"use client";
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Eye, Edit, Trash2, Upload, Download, Barcode, Package, AlertTriangle, Clock, Shield, FileText, TrendingUp, Layers, ShoppingCart, Truck, History, Users, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { productTypes, dosageForms, strengthUnits, routes, classifications } from "@/lib/validations/products";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { db } from "@/lib/offline/db";
import { queueProductCreate, queueProductUpdate, queueProductDeactivate, getProductPendingCount } from "@/lib/offline/sync";
import { readCachedCategories, readCachedProducts, readCachedStock } from "@/lib/offline/catalog";
import { WifiOff } from "lucide-react";

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const twoYearsFromNow = (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return localDateStr(d);
})();

// Types
type ProductRow = {
  id:string; name:string; generic_name?:string|null; brand_name?:string|null; sku:string; barcode:string|null;
  category_id?:string|null; product_type?:string; dosage_form?:string|null; strength?:string|null; strength_unit?:string|null;
  manufacturer?:string|null; registration_number?:string|null; classification?:string|null;
  reorder_level:number; min_stock?:number|null; max_stock?:number|null;
  track_batch?:boolean; track_expiry?:boolean; fefo_enabled?:boolean;
  default_purchase_cost?:number|null; default_selling_price?:number|null;
  is_active:boolean; created_at:string;
  categories?:{name:string}|null; totalStock?:number; batches?:any[];
};

function StockBadge({stock, reorder, expiring}:{stock:number; reorder:number; expiring:number}){
  if(stock===0) return <Badge variant="destructive">Out of Stock</Badge>;
  if(stock<=reorder) return <Badge variant="warning">Low Stock</Badge>;
  if(expiring>0) return <Badge variant="warning">Expiring Soon</Badge>;
  return <Badge variant="success">In Stock</Badge>;
}
function ExpiryRisk({qty}:{qty:number}){
  if(qty===0) return <span className="text-muted-foreground text-xs">—</span>;
  return <Badge variant="warning">{qty} expiring</Badge>;
}

export default function ProductsPage(){
  const [products,setProducts]=React.useState<ProductRow[]>([]);
  const [loading,setLoading]=React.useState(true);
  const [searchQuery,setSearchQuery]=React.useState("");
  const [debouncedSearch,setDebouncedSearch]=React.useState("");
  const [categoryFilter,setCategoryFilter]=React.useState("all");
  const [typeFilter,setTypeFilter]=React.useState("all");
  const [statusFilter,setStatusFilter]=React.useState("all");
  const [supplierFilter,setSupplierFilter]=React.useState("all");
  const [lowStockOnly,setLowStockOnly]=React.useState(false);
  const [expiringOnly,setExpiringOnly]=React.useState(false);
  const [page,setPage]=React.useState(1);
  const perPage=20;
  const [totalCount,setTotalCount]=React.useState(0);
  const [categories,setCategories]=React.useState<any[]>([]);
  const [units,setUnits]=React.useState<any[]>([]);
  const [suppliers,setSuppliers]=React.useState<any[]>([]);
  const [showAdd,setShowAdd]=React.useState(false);
  const [addStep,setAddStep]=React.useState(1);
  const [saving,setSaving]=React.useState(false);
  const [detailId,setDetailId]=React.useState<string|null>(null);
  const [detail,setDetail]=React.useState<any>(null);
  const [showDetail,setShowDetail]=React.useState(false);
  const [showImport,setShowImport]=React.useState(false);
  const [importRows,setImportRows]=React.useState<any[]>([]);
  const [importErrors,setImportErrors]=React.useState<any[]>([]);
  const [canViewCost,setCanViewCost]=React.useState(true);
  const [editingId,setEditingId]=React.useState<string|null>(null);
  const {isOnline}=useOnlineStatus();
  const [pendingProducts,setPendingProducts]=React.useState(0);
  React.useEffect(()=>{
    const up=async()=>{ setPendingProducts(await getProductPendingCount()); };
    up(); const i=setInterval(up, 3000); return ()=>clearInterval(i);
  },[]);

  const [form,setForm]=React.useState({
    name:"", generic_name:"", brand_name:"", sku:"", barcode:"", product_type:"Human Medicine", category_id:"", unit_id:"", description:"", alternative_names:"",
    strength:"", strength_unit:"", dosage_form:"", route:"", pack_size:"", units_per_pack:"", manufacturer:"", country_of_origin:"", registration_number:"", classification:"OTC",
    reorder_level:10, min_stock:0, max_stock:"", reorder_quantity:"", storage_location:"", shelf:"", rack:"", bin:"",
    track_batch:true, track_expiry:true, fefo_enabled:true, allow_negative_stock:false,
    default_purchase_cost:"", default_selling_price:"", min_selling_price:"", tax_category:"standard", tax_inclusive:false,
    preferred_supplier_id:"", supplier_product_code:"",
    opening_enabled:true, opening_quantity:"", opening_batch_number:"", opening_expiry_date:twoYearsFromNow
  });
  const therapeuticCategories = [
    "Analgesics / Pain Relief","Antipyretics","Anti-inflammatory","Anti-infective / Antimicrobial","Antimalarial","Antiallergic / Antihistamine","Respiratory","Gastrointestinal","Cardiovascular","Endocrine / Metabolic","Dermatological","Ophthalmic","Otic","Oral / Dental","Genitourinary","Reproductive / Maternal Health","Vitamins & Minerals","Electrolytes / Rehydration","Neurological","Musculoskeletal","Blood / Hematological","Immunological","Other / Unclassified"
  ];
  const categoryOptions = React.useMemo(()=>{
    const dbNames = new Set(categories.map((c:any)=>c.name));
    const merged = [...categories];
    for(const t of therapeuticCategories){
      if(!dbNames.has(t)) merged.push({ id: t, name: t, __fallback: true });
    }
    return merged;
  },[categories]);

  // Permissions check (simple)
  React.useEffect(()=>{
    (async()=>{
      try{ const {createBrowserClient}=await import("@/lib/supabase/client"); const sb=createBrowserClient();
        const {data:u}=await sb.auth.getUser(); if(!u.user) return;
        const {data:profile}=await (sb.from("profiles") as any).select("id").eq("auth_user_id", u.user.id).single();
        if(!profile) return;
        const {data:roles}=await (sb.from("user_roles") as any).select("role_id, roles(name)").eq("user_id", profile.id);
        const isManager=(roles??[]).some((r:any)=>["Owner","Administrator","Manager"].includes(r.roles?.name));
        setCanViewCost(isManager);
      }catch{}
    })();
  },[]);

  // Load reference data
  React.useEffect(()=>{
    (async()=>{
      if(!isOnline){
        try{
          const [cats, sups] = await Promise.all([readCachedCategories(), db.cachedSuppliers.toArray().catch(()=>[])]);
          if(cats?.length) setCategories(cats);
          if(sups?.length) setSuppliers(sups.map((s:any)=>({id:s.id, name:s.name})));
        }catch{}
        return;
      }
      try{
        const {createBrowserClient}=await import("@/lib/supabase/client");
        const sb=createBrowserClient();
        const [{data:cats},{data:uns},{data:sups}]=await Promise.all([
          sb.from("categories").select("id, name").eq("is_active",true).order("name"),
          sb.from("units").select("id, name, abbreviation").order("name"),
          sb.from("suppliers").select("id, name").eq("is_active",true).order("name").limit(50),
        ]);
        if(cats) setCategories(cats);
        if(uns) setUnits(uns);
        if(sups) setSuppliers(sups);
      }catch{}
    })();
  },[isOnline]);

  // debounce search
  React.useEffect(()=>{
    const id=setTimeout(()=>setDebouncedSearch(searchQuery), 300);
    return ()=>clearTimeout(id);
  },[searchQuery]);
  React.useEffect(()=>{ setPage(1); },[debouncedSearch, categoryFilter, typeFilter, statusFilter, supplierFilter, lowStockOnly, expiringOnly]);

  // fetch products with stock enrichment (cache-first offline)
  const fetchProducts=React.useCallback(async ()=>{
    setLoading(true);
    try{
      if(!isOnline){
        const [rows, stockRows] = await Promise.all([readCachedProducts(), readCachedStock()]);
        const now=new Date();
        const map:Record<string,{total:number, expiring:number, batches:any[]}> = {};
        for(const b of stockRows){
          const pid=b.product_id;
          if(!map[pid]) map[pid]={total:0, expiring:0, batches:[]};
          map[pid].total+=Number(b.quantity_available??0);
          map[pid].batches.push(b);
          if(b.expiry_date){
            const days=Math.ceil((new Date(b.expiry_date).getTime()-now.getTime())/86400000);
            if(days>=0 && days<=30) map[pid].expiring+=Number(b.quantity_available??0);
          }
        }
        const q=debouncedSearch.toLowerCase().trim();
        const filtered=rows.filter((p:any)=>{
          if(categoryFilter!=="all" && p.category_id!==categoryFilter) return false;
          if(typeFilter!=="all" && p.product_type!==typeFilter) return false;
          if(statusFilter!=="all" && String(p.is_active!==false)!==String(statusFilter==="active")) return false;
          if(q){ const hay=`${p.name} ${p.generic_name??""} ${p.sku??""} ${p.barcode??""} ${p.brand_name??""}`.toLowerCase(); if(!hay.includes(q)) return false; }
          return true;
        });
        let enriched:ProductRow[] = filtered.map((p:any)=>({
          ...p,
          is_active: p.is_active!==false,
          reorder_level: p.reorder_level ?? 10,
          totalStock: map[p.id]?.total ?? 0,
          expiringQty: map[p.id]?.expiring ?? 0,
          batches: map[p.id]?.batches ?? [],
        }));
        if(lowStockOnly) enriched = enriched.filter(p=> (p.totalStock ?? 0) <= (p.reorder_level ?? 10));
        if(expiringOnly) enriched = enriched.filter(p=> (p as any).expiringQty>0);
        setProducts(enriched); setTotalCount(enriched.length);
        setLoading(false);
        return;
      }
      const params=new URLSearchParams();
      if(debouncedSearch) params.set("search", debouncedSearch);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(categoryFilter);
      if(categoryFilter!=="all" && isUuid) params.set("category_id", categoryFilter);
      if(typeFilter!=="all") params.set("product_type", typeFilter);
      if(statusFilter!=="all") params.set("status", statusFilter);
      if(supplierFilter!=="all") params.set("supplier_id", supplierFilter);
      if(lowStockOnly) params.set("lowStock","true");
      if(expiringOnly) params.set("expiring","true");
      params.set("page", String(page)); params.set("perPage", String(perPage));
      const [prodRes, invRes]=await Promise.all([
        fetch(`/api/products?${params.toString()}`).then(r=>r.json()),
        fetch(`/api/inventory`).then(r=>r.json()).catch(()=>({stock:[]})),
      ]);
      let list:any[]=[]; let count=0;
      if(Array.isArray(prodRes)) { list=prodRes; count=prodRes.length; }
      else if(prodRes.data){ list=prodRes.data; count=prodRes.count ?? list.length; }
      else if(prodRes.error) throw new Error(prodRes.error);

      // stock enrichment (single source of truth: product_batches)
      const stockRows:any[] = invRes.stock ?? [];
      const map:Record<string,{total:number, expiring:number, batches:any[]}> = {};
      const now=new Date();
      for(const b of stockRows){
        const pid=b.product_id;
        if(!map[pid]) map[pid]={total:0, expiring:0, batches:[]};
        map[pid].total+=Number(b.quantity_available);
        map[pid].batches.push(b);
        if(b.expiry_date){
          const days=Math.ceil((new Date(b.expiry_date).getTime()-now.getTime())/86400000);
          if(days>=0 && days<=30) map[pid].expiring+=Number(b.quantity_available);
        }
      }
      const enriched:ProductRow[] = list.map((p:any)=>({
        ...p,
        totalStock: map[p.id]?.total ?? 0,
        expiringQty: map[p.id]?.expiring ?? 0,
        batches: map[p.id]?.batches ?? [],
      }));
      let filtered=enriched;
      // client fallback for therapeutic category (fallback id = name) when not yet in DB
      if(categoryFilter!=="all" && !isUuid){
        filtered=filtered.filter((p:any)=> (p.categories?.name || "").toLowerCase() === categoryFilter.toLowerCase());
      }
      if(lowStockOnly) filtered=filtered.filter(p=> (p.totalStock ?? 0) <= (p.reorder_level ?? 10));
      if(expiringOnly) filtered=filtered.filter(p=> (p as any).expiringQty>0);
      setProducts(filtered);
      setTotalCount(count);

      // keep the offline catalog fresh
      try{
        await db.products.bulkPut(list.filter((p:any)=>!p.sync_status || p.sync_status!=="pending").map((p:any)=>({...p, is_active: p.is_active ?? true, sync_status:"synced" as const})) as any);
        await db.batches.bulkPut(stockRows.map((b:any)=>({id:b.id, product_id:b.product_id, branch_id:b.branch_id, batch_number:b.batch_number ?? null, quantity_available:Number(b.quantity_available??0), quantity:Number(b.quantity_available??0), expiry_date:b.expiry_date ?? null, cost_price:Number(b.cost_price ?? b.purchase_price ?? 0), purchase_price:Number(b.purchase_price ?? 0), selling_price:Number(b.selling_price ?? 0)})) as any);
      }catch{}
    }catch(e){ setProducts([]); } finally{ setLoading(false); }
  },[debouncedSearch, categoryFilter, typeFilter, statusFilter, supplierFilter, lowStockOnly, expiringOnly, page, isOnline]);

  React.useEffect(()=>{ fetchProducts(); },[fetchProducts]);

  const totalPages=Math.max(1, Math.ceil(totalCount/perPage));

  async function submitAdd(){
    if(!form.name.trim()) return alert("Product name is required");
    setSaving(true);
    try{
      // Resolve therapeutic fallback category (product.md Section 7) to real DB id if needed
      let resolvedCategoryId = form.category_id;
      if(resolvedCategoryId && therapeuticCategories.includes(resolvedCategoryId) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedCategoryId)){
        try{
          const {createBrowserClient}=await import("@/lib/supabase/client");
          const sb=createBrowserClient();
          const {data: existing}=await (sb.from("categories") as any).select("id").eq("name", resolvedCategoryId).maybeSingle();
          if(existing) resolvedCategoryId = existing.id;
          else {
            const {data: newCat, error}=await (sb.from("categories") as any).insert({ name: resolvedCategoryId, description: `Therapeutic: ${resolvedCategoryId}` }).select().single();
            if(!error && newCat){ resolvedCategoryId = newCat.id; setCategories(prev=>[...prev, newCat]); }
            else resolvedCategoryId = "";
          }
        }catch{ resolvedCategoryId = ""; }
      }
      const payload:any={
        name:form.name.trim(), generic_name:form.generic_name.trim(), brand_name:form.brand_name.trim(),
        sku:form.sku.trim(), barcode:form.barcode.trim(), product_type:form.product_type, category_id:resolvedCategoryId || "", unit_id:form.unit_id || "", description:form.description.trim(), alternative_names: (form as any).alternative_names?.trim() || "",
        strength:form.strength.trim(), strength_unit:form.strength_unit || "", dosage_form:form.dosage_form || "", route:form.route || "",
        pack_size: form.pack_size ? Number(form.pack_size): undefined, units_per_pack: form.units_per_pack ? Number(form.units_per_pack): undefined,
        manufacturer:form.manufacturer.trim(), country_of_origin:form.country_of_origin.trim(), registration_number:form.registration_number.trim(), classification:form.classification,
        reorder_level:Number(form.reorder_level)||0, min_stock:Number(form.min_stock)||0, max_stock: form.max_stock ? Number(form.max_stock): null, reorder_quantity: form.reorder_quantity ? Number(form.reorder_quantity): null,
        storage_location:form.storage_location.trim(), shelf:form.shelf.trim(), rack:form.rack.trim(), bin:form.bin.trim(),
        track_batch: form.track_batch, track_expiry: form.track_expiry, fefo_enabled: form.fefo_enabled, allow_negative_stock: form.allow_negative_stock,
        default_purchase_cost: form.default_purchase_cost ? Number(form.default_purchase_cost): null, default_selling_price: form.default_selling_price ? Number(form.default_selling_price): null, min_selling_price: form.min_selling_price ? Number(form.min_selling_price): null,
        tax_category: form.tax_category, tax_inclusive: form.tax_inclusive, preferred_supplier_id: form.preferred_supplier_id || "",
      };
      if(!editingId && form.opening_enabled && Number(form.opening_quantity)>0){
        payload.initial_stock = { quantity: Number(form.opening_quantity), batch_number: form.opening_batch_number.trim(), expiry_date: form.opening_expiry_date || undefined };
      }
      const method = editingId ? "PATCH" : "POST";
      const body = editingId ? { id: editingId, ...payload } : payload;
      if(!isOnline){
        const op = editingId ? await queueProductUpdate(editingId, payload) : (await queueProductCreate(payload)).operation_id;
        setShowAdd(false); setAddStep(1); setEditingId(null);
        setForm({ name:"", generic_name:"", brand_name:"", sku:"", barcode:"", product_type:"Human Medicine", category_id:"", unit_id:"", description:"", alternative_names:"", strength:"", strength_unit:"", dosage_form:"", route:"", pack_size:"", units_per_pack:"", manufacturer:"", country_of_origin:"", registration_number:"", classification:"OTC", reorder_level:10, min_stock:0, max_stock:"", reorder_quantity:"", storage_location:"", shelf:"", rack:"", bin:"", track_batch:true, track_expiry:true, fefo_enabled:true, allow_negative_stock:false, default_purchase_cost:"", default_selling_price:"", min_selling_price:"", tax_category:"standard", tax_inclusive:false, preferred_supplier_id:"", supplier_product_code:"", opening_enabled:true, opening_quantity:"", opening_batch_number:"", opening_expiry_date:twoYearsFromNow });
        fetchProducts();
        setSaving(false);
        alert("OFFLINE — product saved locally and queued for sync (operation "+op.slice(0,8)+"). It will appear on the server automatically when online.");
        return;
      }
      const res=await fetch("/api/products", { method, headers:{"Content-Type":"application/json"}, body: JSON.stringify(body)});
      const j=await res.json();
      if(!res.ok) throw new Error(j.error || "Failed");
      setShowAdd(false); setAddStep(1); setEditingId(null);
      setForm({ name:"", generic_name:"", brand_name:"", sku:"", barcode:"", product_type:"Human Medicine", category_id:"", unit_id:"", description:"", alternative_names:"", strength:"", strength_unit:"", dosage_form:"", route:"", pack_size:"", units_per_pack:"", manufacturer:"", country_of_origin:"", registration_number:"", classification:"OTC", reorder_level:10, min_stock:0, max_stock:"", reorder_quantity:"", storage_location:"", shelf:"", rack:"", bin:"", track_batch:true, track_expiry:true, fefo_enabled:true, allow_negative_stock:false, default_purchase_cost:"", default_selling_price:"", min_selling_price:"", tax_category:"standard", tax_inclusive:false, preferred_supplier_id:"", supplier_product_code:"", opening_enabled:true, opening_quantity:"", opening_batch_number:"", opening_expiry_date:twoYearsFromNow });
      fetchProducts();
      if(editingId) alert("Product updated");
    }catch(e:any){ alert(e.message); } finally{ setSaving(false); }
  }

  async function openDetail(id:string){
    setDetailId(id); setShowDetail(true);
    try{
      const res=await fetch(`/api/products?id=${id}`).then(r=>r.json());
      setDetail(res && res.product ? res : null);
    }catch{
      // offline: minimal detail from the catalog cache
      try{
        const p=(await readCachedProducts()).find((x:any)=>x.id===id);
        const stockRows=(await readCachedStock()).filter((b:any)=>b.product_id===id);
        const total=stockRows.reduce((s:number,b:any)=>s+Number(b.quantity_available??0),0);
        const expiring=stockRows.filter((b:any)=>b.expiry_date && Math.ceil((new Date(b.expiry_date).getTime()-Date.now())/86400000)<=30).reduce((s:number,b:any)=>s+Number(b.quantity_available??0),0);
        setDetail(p ? { product: p, batches: stockRows, totalStock: total, stockByBranch: {}, lowStock: total <= (p.reorder_level ?? 10), expiringQty: expiring, suppliers: [], priceHistory: [], movements: [], audit: [] } : null);
      }catch{ setDetail(null); }
    }
  }
  async function handleDeactivate(id:string, active:boolean){
    if(!confirm(active ? "Deactivate product? Historical transactions remain intact." : "Reactivate product?")) return;
    if(!isOnline){
      if(active) await queueProductDeactivate(id); else await queueProductUpdate(id, {action:"reactivate"});
      fetchProducts();
      alert("OFFLINE — change queued for sync.");
      return;
    }
    const action= active ? "deactivate" : "reactivate";
    const res=await fetch("/api/products", {method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id, action})});
    const j=await res.json();
    if(!res.ok) return alert(j.error);
    fetchProducts();
  }

  function handleEdit(p:ProductRow){
    setEditingId(p.id);
    setForm({
      name:p.name, generic_name:p.generic_name||"", brand_name:p.brand_name||"", sku:p.sku||"", barcode:p.barcode||"", product_type:(p as any).product_type||"Human Medicine", category_id:(p as any).category_id||"", unit_id:(p as any).unit_id||"", description:(p as any).description||"", alternative_names:(p as any).alternative_names||"",
      strength:(p as any).strength||"", strength_unit:(p as any).strength_unit||"", dosage_form:(p as any).dosage_form||"", route:(p as any).route||"", pack_size:(p as any).pack_size ? String((p as any).pack_size):"", units_per_pack:(p as any).units_per_pack ? String((p as any).units_per_pack):"", manufacturer:(p as any).manufacturer||"", country_of_origin:(p as any).country_of_origin||"", registration_number:(p as any).registration_number||"", classification:(p as any).classification||"OTC",
      reorder_level:p.reorder_level, min_stock:(p as any).min_stock ?? 0, max_stock:(p as any).max_stock ? String((p as any).max_stock):"", reorder_quantity:(p as any).reorder_quantity ? String((p as any).reorder_quantity):"", storage_location:(p as any).storage_location||"", shelf:(p as any).shelf||"", rack:(p as any).rack||"", bin:(p as any).bin||"",
      track_batch:(p as any).track_batch ?? true, track_expiry:(p as any).track_expiry ?? true, fefo_enabled:(p as any).fefo_enabled ?? true, allow_negative_stock:(p as any).allow_negative_stock ?? false,
      default_purchase_cost:(p as any).default_purchase_cost ? String((p as any).default_purchase_cost):"", default_selling_price:(p as any).default_selling_price ? String((p as any).default_selling_price):"", min_selling_price:(p as any).min_selling_price ? String((p as any).min_selling_price):"", tax_category:(p as any).tax_category||"standard", tax_inclusive:(p as any).tax_inclusive||false,
      preferred_supplier_id:(p as any).preferred_supplier_id||"", supplier_product_code:"",
      opening_enabled:false, opening_quantity:"", opening_batch_number:"", opening_expiry_date:twoYearsFromNow
    });
    setAddStep(1); setShowAdd(true);
  }

  function downloadTemplate(){
    const header="Product Name,Generic Name,Brand,SKU,Barcode,Product Type,Category,Dosage Form,Strength,Strength Unit,Pack Size,Manufacturer,Reorder Level,Min Stock,Max Stock,Selling Price,Purchase Cost,Supplier,Tax Category";
    const blob=new Blob([header+"\nParacetamol 500mg,Paracetamol,Panadol,PAR-500,123456789,Human Medicine,Pain Relief,Tablet,500,mg,10,MediPharm,10,0,100,5000,3000,MediPharm Uganda,standard"], {type:"text/csv"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="mediflow_product_template.csv"; a.click(); URL.revokeObjectURL(url);
  }
  async function handleImportFile(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0]; if(!file) return;
    const text=await file.text();
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    const header=lines[0].split(",").map(h=>h.trim().toLowerCase());
    const rows=lines.slice(1).map(line=>{
      const cols=line.split(","); const obj:any={};
      header.forEach((h,i)=> obj[h]= (cols[i]||"").trim());
      return {
        name: obj["product name"]||obj["name"]||"", generic_name: obj["generic name"]||"", brand_name: obj["brand"]||"", sku: obj["sku"]||"", barcode: obj["barcode"]||"", product_type: obj["product type"]||"Human Medicine", category: obj["category"]||"", dosage_form: obj["dosage form"]||"", strength: obj["strength"]||"", strength_unit: obj["strength unit"]||"", pack_size: obj["pack size"]||"", manufacturer: obj["manufacturer"]||"", reorder_level: obj["reorder level"]||"10", min_stock: obj["min stock"]||"0", max_stock: obj["max stock"]||"", selling_price: obj["selling price"]||"", purchase_cost: obj["purchase cost"]||"", supplier: obj["supplier"]||"", tax_category: obj["tax category"]||"standard"
      };
    });
    // preview & validate: duplicate sku/barcode, missing name
    const errs:any[]=[];
    const seenSku=new Set(); const seenBarcode=new Set();
    rows.forEach((r:any,i:number)=>{
      if(!r.name) errs.push({row:i+1, error:"Missing Product Name"});
      if(r.sku && seenSku.has(r.sku)) errs.push({row:i+1, error:`Duplicate SKU in file: ${r.sku}`});
      if(r.barcode && seenBarcode.has(r.barcode)) errs.push({row:i+1, error:`Duplicate Barcode in file: ${r.barcode}`});
      if(r.sku) seenSku.add(r.sku);
      if(r.barcode) seenBarcode.add(r.barcode);
    });
    setImportRows(rows); setImportErrors(errs);
  }
  async function commitImport(){
    const valid = importRows.filter((_,i)=> !importErrors.some(e=>e.row===i+1));
    if(valid.length===0) return alert("No valid rows to import");
    const payload= valid.map(r=>({
      name:r.name, generic_name:r.generic_name, brand_name:r.brand_name, sku:r.sku, barcode:r.barcode, product_type:r.product_type, category:r.category, dosage_form:r.dosage_form, strength:r.strength, strength_unit:r.strength_unit, pack_size:r.pack_size, manufacturer:r.manufacturer, reorder_level: Number(r.reorder_level)||10, min_stock: Number(r.min_stock)||0, max_stock: r.max_stock ? Number(r.max_stock): null, selling_price: r.selling_price ? Number(r.selling_price): null, purchase_cost: r.purchase_cost ? Number(r.purchase_cost): null
    }));
    // map category name to id (including therapeutic fallback)
    const catMap=new Map(categoryOptions.map(c=>[(c.name as string).toLowerCase(), c.id]));
    // Ensure therapeutic categories exist in DB before import (create missing)
    for(const p of payload){
      const key=(p.category||"").toLowerCase();
      const mapped=catMap.get(key);
      if(p.category && therapeuticCategories.map(t=>t.toLowerCase()).includes(key) && mapped && !/^[0-9a-f]{8}-/.test(mapped)){
        try{
          const {createBrowserClient}=await import("@/lib/supabase/client");
          const sb=createBrowserClient();
          const {data: existing}=await (sb.from("categories") as any).select("id").eq("name", p.category).maybeSingle();
          if(existing){ catMap.set(key, existing.id); }
          else{
            const {data: newCat}=await (sb.from("categories") as any).insert({ name: p.category, description: `Therapeutic: ${p.category}` }).select().single();
            if(newCat){ catMap.set(key, newCat.id); setCategories(prev=>[...prev, newCat]); }
          }
        }catch{}
      }
    }
    const rowsForImport=payload.map(p=>({ name:p.name, sku:p.sku, barcode:p.barcode, category_id: /^[0-9a-f]{8}-/.test(catMap.get((p.category||"").toLowerCase())||"") ? catMap.get((p.category||"").toLowerCase())||"" : "", generic_name:p.generic_name, brand_name:p.brand_name, dosage_form:p.dosage_form, strength:p.strength, strength_unit:p.strength_unit, pack_size:p.pack_size, manufacturer:p.manufacturer, reorder_level:p.reorder_level, min_stock:p.min_stock, max_stock:p.max_stock, default_selling_price:p.selling_price, default_purchase_cost:p.purchase_cost }));
    const res=await fetch("/api/products", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({action:"bulk_import", rows: rowsForImport})});
    const j=await res.json();
    alert(`Imported ${j.success} succeeded, ${j.failed} failed`);
    if(j.success) fetchProducts();
    setShowImport(false); setImportRows([]); setImportErrors([]);
  }

  function generateBarcode(){ const code=""+Math.floor(100000000000 + Math.random()*900000000000); setForm(f=>({...f, barcode: code})); }

  const clearFilters=()=>{ setCategoryFilter("all"); setTypeFilter("all"); setStatusFilter("all"); setSupplierFilter("all"); setLowStockOnly(false); setExpiringOnly(false); setSearchQuery(""); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6"/>Products</h1>
          <p className="text-muted-foreground">Pharmacy Product Master & Catalog — single source of truth for POS, Inventory, Purchases, Reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isOnline && <Badge variant="warning"><WifiOff className="h-3 w-3 mr-1"/>OFFLINE — changes queue locally</Badge>}
          {pendingProducts>0 && <Badge variant="warning">{pendingProducts} pending sync</Badge>}
          <Button variant="outline" onClick={()=>setShowImport(true)}><Upload className="h-4 w-4 mr-2"/>Import</Button>
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2"/>Template</Button>
          <Button onClick={()=>{ setEditingId(null); setAddStep(1); setShowAdd(true); }}><Plus className="h-4 w-4 mr-2"/>Add Product</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input placeholder="Search name / generic / brand / SKU / barcode / manufacturer..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-9" aria-label="Search products"/>
            </div>
            <Button variant="outline" onClick={clearFilters}><X className="h-4 w-4 mr-2"/>Clear</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="w-[200px]">
              <option value="all">All Product Types</option>
              {productTypes.map(t=><option key={t} value={t}>{t}</option>)}
            </Select>
            <Select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} className="w-[200px]">
              <option value="all">All Categories</option>
              {categoryOptions.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-[150px]">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <Select value={supplierFilter} onChange={e=>setSupplierFilter(e.target.value)} className="w-[180px]">
              <option value="all">All Suppliers</option>
              {suppliers.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <label className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 cursor-pointer"><input type="checkbox" checked={lowStockOnly} onChange={e=>setLowStockOnly(e.target.checked)}/> Low Stock</label>
            <label className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 cursor-pointer"><input type="checkbox" checked={expiringOnly} onChange={e=>setExpiringOnly(e.target.checked)}/> Expiring Soon</label>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Barcode className="h-3 w-3"/> Barcode searchable</span>
            <span className="flex items-center gap-1"><Shield className="h-3 w-3"/> Tax & NDA fields preserved</span>
            <span className="flex items-center gap-1"><Layers className="h-3 w-3"/> FEFO via batches</span>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[...Array(6)].map((_,i)=><div key={i} className="flex gap-4"><Skeleton className="h-12 w-12"/><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48"/><Skeleton className="h-3 w-32"/></div><Skeleton className="h-8 w-20"/></div>)}</div>
          ) : products.length===0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center"><Package className="h-12 w-12 text-muted-foreground mb-3"/><p className="font-medium">No products found</p><p className="text-sm text-muted-foreground">Adjust search/filters or add your first product</p><Button className="mt-4" onClick={()=>setShowAdd(true)}>Add Product</Button></div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Generic</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Strength</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Stock Status</TableHead>
                      <TableHead>Expiry Risk</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(p=>(
                      <TableRow key={p.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium max-w-[200px] truncate" title={p.name}>{p.name}<div className="text-xs text-muted-foreground truncate">{(p as any).manufacturer||""}</div></TableCell>
                        <TableCell className="text-muted-foreground">{p.generic_name||"—"}</TableCell>
                        <TableCell className="font-mono text-xs">{p.sku||"—"}</TableCell>
                        <TableCell className="font-mono text-xs">{p.barcode ? <span className="inline-flex items-center gap-1"><Barcode className="h-3 w-3"/>{p.barcode}</span> : "—"}</TableCell>
                        <TableCell>{(p as any).categories?.name || "—"}</TableCell>
                        <TableCell>{(p as any).dosage_form||"—"}</TableCell>
                        <TableCell>{(p as any).strength ? `${(p as any).strength}${(p as any).strength_unit||""}`:"—"}</TableCell>
                        <TableCell className="text-right font-medium">{p.totalStock ?? 0}</TableCell>
                        <TableCell className="text-right">{(p as any).default_selling_price ? `UGX ${Number((p as any).default_selling_price).toLocaleString()}` : "—"}</TableCell>
                        <TableCell><Badge variant={p.is_active ? "success":"secondary"}>{p.is_active ? "Active":"Inactive"}</Badge></TableCell>
                        <TableCell><StockBadge stock={p.totalStock ?? 0} reorder={p.reorder_level} expiring={(p as any).expiringQty ?? 0}/></TableCell>
                        <TableCell><ExpiryRisk qty={(p as any).expiringQty ?? 0}/></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={()=>openDetail(p.id)} aria-label="View"><Eye className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" onClick={()=>handleEdit(p)} aria-label="Edit"><Edit className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" onClick={()=>handleDeactivate(p.id, p.is_active)} aria-label={p.is_active?"Deactivate":"Reactivate"}>{p.is_active ? <Trash2 className="h-4 w-4"/> : <History className="h-4 w-4"/>}</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile cards */}
              <div className="lg:hidden p-4 grid gap-3 sm:grid-cols-2">
                {products.map(p=>(
                  <Card key={p.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between gap-2"><p className="font-semibold line-clamp-2">{p.name}</p><Badge variant={p.is_active?"success":"secondary"}>{p.is_active?"Active":"Inactive"}</Badge></div>
                      {p.generic_name && <p className="text-xs text-muted-foreground">{p.generic_name} • {(p as any).brand_name||""}</p>}
                      <div className="flex flex-wrap gap-1 text-xs"><span className="font-mono">{p.sku||"No SKU"}</span>{p.barcode && <span className="inline-flex items-center gap-1"><Barcode className="h-3 w-3"/>{p.barcode}</span>}</div>
                      <div className="flex flex-wrap gap-1"><StockBadge stock={p.totalStock??0} reorder={p.reorder_level} expiring={(p as any).expiringQty??0}/> {(p as any).expiringQty>0 && <ExpiryRisk qty={(p as any).expiringQty}/>}</div>
                      <div className="flex justify-between text-sm"><span>Stock: <strong>{p.totalStock ?? 0}</strong></span><span>{(p as any).default_selling_price ? `UGX ${Number((p as any).default_selling_price).toLocaleString()}`:"—"}</span></div>
                      <div className="flex gap-1"><Button size="sm" variant="outline" className="flex-1" onClick={()=>openDetail(p.id)}><Eye className="h-4 w-4 mr-1"/>View</Button><Button size="sm" variant="outline" className="flex-1" onClick={()=>handleEdit(p)}><Edit className="h-4 w-4 mr-1"/>Edit</Button></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Showing {(page-1)*perPage+1}–{Math.min(page*perPage, totalCount)} of {totalCount} • Page {page}/{totalPages}</p>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}><ChevronLeft className="h-4 w-4"/>Previous</Button><Button variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next<ChevronRight className="h-4 w-4 ml-1"/></Button></div>
      </div>

      {/* Product Profile Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5"/>Product Profile</DialogTitle><DialogDescription>Master data — stock, batches, suppliers, history. Price changes do not rewrite history.</DialogDescription></DialogHeader>
          {!detail ? <div className="p-6"><Skeleton className="h-40 w-full"/></div> : (
            <Tabs value={detailId ? "overview" : "overview"} defaultValue="overview" onValueChange={()=>{}}>
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="batches">Batches</TabsTrigger>
                <TabsTrigger value="stock">Stock</TabsTrigger>
                <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                <TabsTrigger value="purchases">Purchases</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="movements">Movements</TabsTrigger>
                <TabsTrigger value="price">Price History</TabsTrigger>
                <TabsTrigger value="audit">Audit</TabsTrigger>
              </TabsList>
              {/* Simple tab state handled via manual */}
              <div className="mt-4 space-y-6">
                {/* Overview */}
                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4"/>Overview</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <strong>{detail.product.name}</strong></div>
                  <div><span className="text-muted-foreground">Generic:</span> {detail.product.generic_name||"—"}</div>
                  <div><span className="text-muted-foreground">Brand:</span> {detail.product.brand_name||"—"}</div>
                  <div><span className="text-muted-foreground">SKU:</span> <span className="font-mono">{detail.product.sku||"—"}</span></div>
                  <div><span className="text-muted-foreground">Barcode:</span> <span className="font-mono flex items-center gap-1">{detail.product.barcode ? <><Barcode className="h-4 w-4"/>{detail.product.barcode}</>: "—"}</span></div>
                  <div><span className="text-muted-foreground">Category:</span> {detail.product.categories?.name||"—"}</div>
                  <div><span className="text-muted-foreground">Type:</span> {detail.product.product_type||"—"}</div>
                  <div><span className="text-muted-foreground">Form:</span> {detail.product.dosage_form||"—"}</div>
                  <div><span className="text-muted-foreground">Strength:</span> {detail.product.strength ? `${detail.product.strength}${detail.product.strength_unit||""}`:"—"}</div>
                  <div><span className="text-muted-foreground">Manufacturer:</span> {detail.product.manufacturer||"—"}</div>
                  <div><span className="text-muted-foreground">Country:</span> {detail.product.country_of_origin||"—"}</div>
                  <div><span className="text-muted-foreground">Reg No:</span> {detail.product.registration_number||"—"}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={detail.product.is_active?"success":"secondary"}>{detail.product.is_active?"Active":"Inactive"}</Badge></div>
                </CardContent></Card>

                <div className="grid gap-4 md:grid-cols-3">
                  <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4"/>Stock</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{detail.totalStock}</p><p className="text-xs text-muted-foreground">Total available • By branch: {Object.entries(detail.stockByBranch).map(([k,v])=>`${v}`).join(", ")||"—"}</p>{detail.lowStock && <Badge variant="warning" className="mt-2">Low Stock</Badge>}{detail.expiringQty>0 && <Badge variant="warning" className="mt-2 ml-1">Expiring: {detail.expiringQty}</Badge>}</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Pricing</CardTitle></CardHeader><CardContent><p className="text-sm">Purchase: <strong>{detail.product.default_purchase_cost ? `UGX ${Number(detail.product.default_purchase_cost).toLocaleString()}`:"—"}</strong></p><p className="text-sm">Selling: <strong>{detail.product.default_selling_price ? `UGX ${Number(detail.product.default_selling_price).toLocaleString()}`:"—"}</strong></p>{canViewCost ? <p className="text-xs text-muted-foreground">Margin: {detail.product.default_selling_price && detail.product.default_purchase_cost ? `${Math.round((1-Number(detail.product.default_purchase_cost)/Number(detail.product.default_selling_price))*100)}%`: "—"}</p> : <p className="text-xs text-muted-foreground">Cost hidden by permission</p>}</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4"/>Location</CardTitle></CardHeader><CardContent><p className="text-sm">{detail.product.storage_location||"—"}</p><p className="text-xs text-muted-foreground">Shelf {detail.product.shelf||"—"} • Rack {detail.product.rack||"—"} • Bin {detail.product.bin||"—"}</p><p className="text-xs mt-1">Batch:{detail.product.track_batch?" ✔":" ✘"} Expiry:{detail.product.track_expiry?" ✔":" ✘"} FEFO:{detail.product.fefo_enabled?" ✔":" ✘"}</p></CardContent></Card>
                </div>

                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4"/>Batches (FEFO)</CardTitle><CardDescription>Inventory lot — expiry-aware, FEFO selection used by POS</CardDescription></CardHeader><CardContent>
                  {detail.batches?.length===0 ? <p className="text-sm text-muted-foreground">No batches — purchase receiving creates batches</p> : <Table><TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Qty Avail</TableHead><TableHead>Qty Recv</TableHead><TableHead>Purchase</TableHead><TableHead>Selling</TableHead><TableHead>Supplier</TableHead></TableRow></TableHeader><TableBody>{detail.batches.map((b:any)=><TableRow key={b.id}><TableCell className="font-mono">{b.batch_number}</TableCell><TableCell>{new Date(b.expiry_date).toLocaleDateString()} {Math.ceil((new Date(b.expiry_date).getTime()-Date.now())/86400000)<=30 && <Badge variant="warning">Soon</Badge>} {new Date(b.expiry_date) < new Date() && <Badge variant="destructive">Expired</Badge>}</TableCell><TableCell>{b.quantity_available}</TableCell><TableCell>{b.quantity_received}</TableCell><TableCell>{canViewCost ? `UGX ${Number(b.purchase_price).toLocaleString()}`:"—"}</TableCell><TableCell>UGX {Number(b.selling_price).toLocaleString()}</TableCell><TableCell>{b.suppliers?.name||b.supplier_id?.slice(0,8)||"—"}</TableCell></TableRow>)}</TableBody></Table>}
                </CardContent></Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4"/>Suppliers</CardTitle></CardHeader><CardContent>{detail.suppliers?.length===0 ? <p className="text-sm text-muted-foreground">Multiple suppliers supported — link preferred & alternate</p> : <div className="space-y-2">{detail.suppliers.map((s:any)=><div key={s.id} className="flex justify-between border rounded p-2 text-sm"><span>{s.suppliers?.name} {s.is_preferred && <Badge variant="success">Preferred</Badge>}</span><span className="text-muted-foreground">{s.supplier_product_code||""}</span></div>)}</div>}</CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4"/>Price History</CardTitle></CardHeader><CardContent>{detail.priceHistory?.length===0 ? <p className="text-sm text-muted-foreground">No price changes — historical sales preserve transaction price</p> : <div className="space-y-1 text-sm">{detail.priceHistory.map((h:any)=><div key={h.id} className="flex justify-between"><span>{h.field_name}</span><span>{h.old_value||"—"} → {h.new_value||h.new_value}</span><span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span></div>)}</div>}</CardContent></Card>
                </div>

                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4"/>Stock Movements</CardTitle></CardHeader><CardContent>{detail.movements?.length===0 ? <p className="text-sm text-muted-foreground">No movements yet</p> : <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>Batch</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{detail.movements.map((m:any)=><TableRow key={m.id}><TableCell><Badge variant="outline">{m.movement_type}</Badge></TableCell><TableCell>{m.quantity}</TableCell><TableCell className="font-mono text-xs">{m.product_batches?.batch_number||m.batch_id?.slice(0,8)||"—"}</TableCell><TableCell className="text-xs">{new Date(m.created_at).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4"/>Audit</CardTitle></CardHeader><CardContent>{detail.audit?.length===0 ? <p className="text-sm text-muted-foreground">No audit — product created/edited/archived are logged</p> : <div className="space-y-2 text-sm">{detail.audit.map((a:any)=><div key={a.id} className="border rounded p-2"><p className="font-medium">{a.action}</p><p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p></div>)}</div>}</CardContent></Card>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={()=>openDetail(detail.product.id)}><Clock className="h-4 w-4 mr-2"/>Refresh</Button>
                  <Button variant="outline" onClick={()=>{ setShowDetail(false); handleEdit(detail.product); }}><Edit className="h-4 w-4 mr-2"/>Edit</Button>
                  <Button variant="outline" onClick={()=> window.location.href=`/pos` }><ShoppingCart className="h-4 w-4 mr-2"/>Sell in POS</Button>
                  <Button variant="outline" onClick={()=> window.location.href=`/inventory`}><Layers className="h-4 w-4 mr-2"/>Inventory</Button>
                </div>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Product — 6 steps */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader><DialogTitle>{editingId ? "Edit Product" : "Add Product"} — Step {addStep}/6</DialogTitle><DialogDescription>Master product — changing config does not rewrite historical sales (transaction price preserved)</DialogDescription></DialogHeader>

          <div className="flex gap-1 mb-2 overflow-x-auto">
            {["Identity","Pharma","Inventory","Pricing","Supplier","Review"].map((s,i)=><Badge key={s} variant={addStep===i+1?"default":"secondary"}>{i+1}. {s}</Badge>)}
          </div>

          {addStep===1 && (
            <div className="space-y-4">
              <div><Label>Product/Brand Name *</Label><Input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Paracetamol 500mg Tablet"/></div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Generic/INN</Label><Input value={form.generic_name} onChange={e=>setForm({...form, generic_name:e.target.value})} placeholder="Paracetamol"/></div>
                <div><Label>Brand</Label><Input value={form.brand_name} onChange={e=>setForm({...form, brand_name:e.target.value})} placeholder="Panadol"/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>SKU / Internal Code</Label><Input value={form.sku} onChange={e=>setForm({...form, sku:e.target.value})} placeholder="PAR-500"/></div>
                <div><Label>Barcode / GTIN</Label><div className="flex gap-2"><Input value={form.barcode} onChange={e=>setForm({...form, barcode:e.target.value})} placeholder="Manufacturer GTIN"/><Button type="button" variant="outline" onClick={generateBarcode}><Barcode className="h-4 w-4 mr-1"/>Generate</Button></div><p className="text-xs text-muted-foreground">Unique — preserves manufacturer GTIN if present</p></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Product Type</Label><Select value={form.product_type} onChange={e=>setForm({...form, product_type:e.target.value})}><option value="">Select</option>{productTypes.map(t=><option key={t} value={t}>{t}</option>)}</Select></div>
                <div><Label>Category (Therapeutic)</Label><Select value={form.category_id} onChange={e=>setForm({...form, category_id:e.target.value})}><option value="">No category</option>{categoryOptions.map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
              </div>
              <div><Label>Alternative/Search Names</Label><Input value={form.alternative_names} onChange={e=>setForm({...form, alternative_names:e.target.value})} placeholder="Also known as... (comma separated)"/></div>
              <div><Label>Short Description</Label><Textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} placeholder="Product master description"/></div>
            </div>
          )}

          {addStep===2 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Strength</Label><Input value={form.strength} onChange={e=>setForm({...form, strength:e.target.value})} placeholder="500"/></div>
                <div><Label>Unit</Label><Select value={form.strength_unit} onChange={e=>setForm({...form, strength_unit:e.target.value})}><option value="">Select</option>{strengthUnits.map(u=><option key={u} value={u}>{u}</option>)}</Select></div>
                <div><Label>Dosage Form</Label><Select value={form.dosage_form} onChange={e=>setForm({...form, dosage_form:e.target.value})}><option value="">Select</option>{dosageForms.map(f=><option key={f} value={f}>{f}</option>)}</Select></div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Route</Label><Select value={form.route} onChange={e=>setForm({...form, route:e.target.value})}><option value="">Select</option>{routes.map(r=><option key={r} value={r}>{r}</option>)}</Select></div>
                <div><Label>Pack Size</Label><Input type="number" value={form.pack_size} onChange={e=>setForm({...form, pack_size:e.target.value})}/></div>
                <div><Label>Units per Pack</Label><Input type="number" value={form.units_per_pack} onChange={e=>setForm({...form, units_per_pack:e.target.value})}/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Selling Unit</Label><Select value={form.unit_id} onChange={e=>setForm({...form, unit_id:e.target.value})}><option value="">Select</option>{units.map(u=><option key={u.id} value={u.id}>{u.name} {u.abbreviation&&`(${u.abbreviation})`}</option>)}</Select></div>
                <div><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={e=>setForm({...form, manufacturer:e.target.value})} placeholder="MediPharm Ltd"/></div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Country of Origin</Label><Input value={form.country_of_origin} onChange={e=>setForm({...form, country_of_origin:e.target.value})}/></div>
                <div><Label>Reg No (NDA-ready)</Label><Input value={form.registration_number} onChange={e=>setForm({...form, registration_number:e.target.value})} placeholder="NDA/REG/..."/></div>
                <div><Label>Classification</Label><Select value={form.classification} onChange={e=>setForm({...form, classification:e.target.value})}><option value="OTC">OTC</option><option value="Prescription">Prescription</option><option value="Controlled">Controlled</option><option value="Herbal">Herbal</option><option value="Supplement">Supplement</option></Select></div>
              </div>
            </div>
          )}

          {addStep===3 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Reorder Level *</Label><Input type="number" min={0} value={form.reorder_level} onChange={e=>setForm({...form, reorder_level:Number(e.target.value)})}/></div>
                <div><Label>Min Stock</Label><Input type="number" min={0} value={form.min_stock} onChange={e=>setForm({...form, min_stock:Number(e.target.value)})}/></div>
                <div><Label>Max/Target Stock</Label><Input type="number" min={0} value={form.max_stock} onChange={e=>setForm({...form, max_stock:e.target.value})}/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Reorder Quantity</Label><Input type="number" min={0} value={form.reorder_quantity} onChange={e=>setForm({...form, reorder_quantity:e.target.value})}/></div>
                <div><Label>Storage Location</Label><Input value={form.storage_location} onChange={e=>setForm({...form, storage_location:e.target.value})} placeholder="Main Store"/></div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Shelf</Label><Input value={form.shelf} onChange={e=>setForm({...form, shelf:e.target.value})}/></div>
                <div><Label>Rack</Label><Input value={form.rack} onChange={e=>setForm({...form, rack:e.target.value})}/></div>
                <div><Label>Bin</Label><Input value={form.bin} onChange={e=>setForm({...form, bin:e.target.value})}/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 border rounded p-3">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.track_batch} onChange={e=>setForm({...form, track_batch:e.target.checked})}/> Track Batch</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.track_expiry} onChange={e=>setForm({...form, track_expiry:e.target.checked})}/> Track Expiry</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.fefo_enabled} onChange={e=>setForm({...form, fefo_enabled:e.target.checked})}/> FEFO Enabled</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allow_negative_stock} onChange={e=>setForm({...form, allow_negative_stock:e.target.checked})}/> Allow Negative Stock</label>
              </div>
              {!editingId && (
                <div className="border rounded p-3 space-y-3 bg-muted/20">
                  <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.opening_enabled} onChange={e=>setForm({...form, opening_enabled:e.target.checked})}/> Add opening stock now — creates a FEFO batch, sellable in POS immediately</label>
                  {form.opening_enabled && (
                    <div className="grid md:grid-cols-3 gap-3">
                      <div><Label>Opening Quantity *</Label><Input type="number" min={0} value={form.opening_quantity} onChange={e=>setForm({...form, opening_quantity:e.target.value})} placeholder="e.g. 100"/></div>
                      <div><Label>Batch Number</Label><Input value={form.opening_batch_number} onChange={e=>setForm({...form, opening_batch_number:e.target.value})} placeholder="auto: OPEN-YYYYMMDD-XXXX"/></div>
                      <div><Label>Expiry Date</Label><Input type="date" min={localDateStr(new Date())} value={form.opening_expiry_date} onChange={e=>setForm({...form, opening_expiry_date:e.target.value})}/></div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Leave blank for no opening stock. Batch purchase/selling price uses the Default Purchase Cost &amp; Default Selling Price from Step 4. Stock lands on the first active branch.</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Batches/expiry are inventory data — not product master. FEFO uses existing batch logic.</p>
            </div>
          )}

          {addStep===4 && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-3 gap-3">
                <div><Label>Default Purchase Cost {canViewCost ? "" : "(hidden)"}</Label><Input type="number" min={0} value={form.default_purchase_cost} onChange={e=>setForm({...form, default_purchase_cost:e.target.value})} disabled={!canViewCost}/></div>
                <div><Label>Default Selling Price</Label><Input type="number" min={0} value={form.default_selling_price} onChange={e=>setForm({...form, default_selling_price:e.target.value})}/></div>
                <div><Label>Min Selling Price</Label><Input type="number" min={0} value={form.min_selling_price} onChange={e=>setForm({...form, min_selling_price:e.target.value})}/></div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Tax Category</Label><Select value={form.tax_category} onChange={e=>setForm({...form, tax_category:e.target.value})}><option value="standard">Standard</option><option value="zero">Zero</option><option value="exempt">Exempt</option></Select></div>
                <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={form.tax_inclusive} onChange={e=>setForm({...form, tax_inclusive:e.target.checked})}/> Tax Inclusive</label>
              </div>
              <p className="text-xs text-muted-foreground">Historical sales preserve transaction price — changing master price does not rewrite COGS.</p>
            </div>
          )}

          {addStep===5 && (
            <div className="space-y-4">
              <div><Label>Preferred Supplier</Label><Select value={form.preferred_supplier_id} onChange={e=>setForm({...form, preferred_supplier_id:e.target.value})}><option value="">None</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
              <div><Label>Supplier Product Code</Label><Input value={form.supplier_product_code} onChange={e=>setForm({...form, supplier_product_code:e.target.value})}/></div>
              <p className="text-xs text-muted-foreground">Product supports multiple suppliers via <code>product_suppliers</code> — purchase orders create batches → stock. Preferred supplier guides receiving.</p>
              <div className="flex gap-2"><Button variant="outline" onClick={()=> window.location.href="/suppliers"}><Truck className="h-4 w-4 mr-2"/>Manage Suppliers</Button></div>
            </div>
          )}

          {addStep===6 && (
            <div className="space-y-3 text-sm">
              <Card><CardContent className="p-4 space-y-1"><p><strong>Name:</strong> {form.name} {form.strength && `${form.strength}${form.strength_unit}`} ({form.dosage_form||"—"})</p><p><strong>SKU:</strong> {form.sku||"—"} • <strong>Barcode:</strong> {form.barcode||"—"} • <strong>Type:</strong> {form.product_type}</p><p><strong>Category:</strong> {categoryOptions.find((c:any)=>c.id===form.category_id)?.name || form.category_id || "—"} • <strong>Manuf:</strong> {form.manufacturer||"—"} • <strong>Reg:</strong> {form.registration_number||"—"}</p><p><strong>Stock:</strong> Reorder {form.reorder_level} • Min {form.min_stock} • Max {form.max_stock||"—"} • Loc {form.storage_location||"—"} {form.shelf&&`S:${form.shelf}`} </p><p><strong>Pricing:</strong> Cost {form.default_purchase_cost||"—"} • Sell {form.default_selling_price||"—"} • Tax {form.tax_category}</p><p><strong>Supplier:</strong> {suppliers.find(s=>s.id===form.preferred_supplier_id)?.name||"—"}</p>{!editingId && form.opening_enabled && Number(form.opening_quantity)>0 && <p><strong>Opening stock:</strong> {form.opening_quantity} units{form.opening_batch_number?` · Batch ${form.opening_batch_number}`:''} · Exp {form.opening_expiry_date||"auto +2y"}</p>}</CardContent></Card>
              <p className="text-xs text-muted-foreground">Review — go back to edit any step. Saving creates the product; if opening stock was set it also creates a FEFO batch, immediately sellable in POS. Without it, stock stays 0 until a purchase is received.</p>
            </div>
          )}

          <div className="flex justify-between gap-2 mt-4">
            <Button variant="outline" disabled={addStep===1} onClick={()=>setAddStep(s=>s-1)}>Back</Button>
            {addStep<6 ? <Button onClick={()=>setAddStep(s=>s+1)}>Next</Button> : <Button onClick={submitAdd} disabled={saving || !form.name.trim()}>{saving?"Saving...": editingId ? "Update Product" : "Create Product"}</Button>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-2xl bg-card">
          <DialogHeader><DialogTitle>Bulk Import — CSV</DialogTitle><DialogDescription>Download template → upload → validate → import valid rows (duplicate SKU/barcode blocked)</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2"><Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2"/>Download Template</Button><label className="flex-1"><Input type="file" accept=".csv" onChange={handleImportFile}/></label></div>
            {importRows.length>0 && <Card><CardContent className="p-4"><p className="text-sm mb-2">Preview: {importRows.length} rows • Valid: {importRows.length - importErrors.length} • Errors: {importErrors.length}</p><div className="max-h-40 overflow-auto border rounded">{importRows.slice(0,5).map((r,i)=><div key={i} className="text-xs p-1 border-b">{r.name} • {r.sku} {importErrors.some(e=>e.row===i+1) && <Badge variant="destructive">Error</Badge>}</div>)}</div>{importErrors.length>0 && <div className="mt-2 space-y-1">{importErrors.map((e,i)=><p key={i} className="text-xs text-destructive">Row {e.row}: {e.error}</p>)}</div>}</CardContent></Card>}
            <div className="flex gap-2"><Button variant="outline" onClick={()=>setShowImport(false)}>Cancel</Button><Button onClick={commitImport} disabled={importRows.length===0}>Import Valid ({importRows.length - importErrors.length})</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
