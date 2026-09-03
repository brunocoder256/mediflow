"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, ShoppingCart, Plus, Minus, Trash2, Banknote, CreditCard, Smartphone, Pause, Receipt as ReceiptIcon, WifiOff, MapPin } from "lucide-react";
import { Receipt, printReceipt } from "@/components/receipt";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { db } from "@/lib/offline/db";

type Product = { id:string; name:string; sku:string; barcode:string|null; stock:number; price:number; category?:string };
type CartItem = { product_id:string; name:string; quantity:number; unit_price:number; discount:number };

export default function PosPage(){
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = React.useState<'CASH'|'MOBILE_MONEY'|'CARD'|'BANK'|'OTHER'>('CASH');
  const [branches,setBranches]=React.useState<any[]>([]);
  const [branchId,setBranchId]=React.useState("b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");
  const [receiptData, setReceiptData] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [held, setHeld] = React.useState<any[]>([]);
  const {isOnline}=useOnlineStatus();

  React.useEffect(()=>{
    fetch("/api/settings").then(r=>r.json()).then(j=>{ if(j.branches?.length){ setBranches(j.branches); if(!branches.length) setBranchId(j.branches[0].id); } }).catch(()=>{});
    fetch("/api/products").then(r=>r.json()).then(j=>{
      const list = Array.isArray(j) ? j : j.data ?? [];
      // normalize: DB product has sku, barcode, but need stock/price from batches
      // For now map: stock = 0 unless via inventory value; use fallback price 0
      // Try fetch inventory for stock
      return fetch("/api/inventory").then(rr=>rr.json()).then(inv=>{
        const stockMap: Record<string, {qty:number, price:number}> = {};
        for(const b of (inv.stock ?? [])){
          const pid=b.product_id;
          if(!stockMap[pid]) stockMap[pid]={qty:0, price: Number(b.selling_price ?? 0)};
          stockMap[pid].qty += Number(b.quantity_available);
          if(!stockMap[pid].price) stockMap[pid].price = Number(b.selling_price);
        }
        const mapped:Product[] = (list as any[]).map((p:any)=>({
          id:p.id, name:p.name, sku:p.sku ?? '', barcode:p.barcode ?? null,
          stock: stockMap[p.id]?.qty ?? 0,
          price: stockMap[p.id]?.price ?? 0,
          category: p.category_id ?? ''
        }));
        setProducts(mapped);
        setLoading(false);
      }).catch(()=>{
        const mapped:Product[] = (list as any[]).map((p:any)=>({id:p.id,name:p.name,sku:p.sku??'',barcode:p.barcode??null,stock:0,price:0}));
        setProducts(mapped); setLoading(false);
      });
    }).catch(()=>setLoading(false));
  },[]);

  const filtered = products.filter(p=>{
    const q=searchQuery.toLowerCase().trim();
    if(!q) return true;
    // barcode exact match triggers add
    if(p.barcode && p.barcode.toLowerCase()===q) return true;
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode??'').toLowerCase().includes(q);
  });

  // auto-add on barcode exact
  React.useEffect(()=>{
    const exact = products.find(p=>p.barcode && p.barcode.toLowerCase()===searchQuery.toLowerCase());
    if(exact && searchQuery.length>4){ addToCart(exact); setSearchQuery(""); }
  },[searchQuery, products]);

  const addToCart=(p:Product)=>{
    if(p.stock===0) return;
    setCart(prev=>{
      const ex=prev.find(x=>x.product_id===p.id);
      if(ex){
        if(ex.quantity >= p.stock) return prev;
        return prev.map(x=> x.product_id===p.id ? {...x, quantity: x.quantity+1} : x);
      }
      return [...prev, {product_id:p.id, name:p.name, quantity:1, unit_price: p.price, discount:0}];
    });
  };
  const updateQty=(id:string, delta:number)=> setCart(c=> c.map(x=> x.product_id===id ? {...x, quantity: Math.max(0, x.quantity+delta)}:x).filter(x=>x.quantity>0));
  const remove=(id:string)=> setCart(c=> c.filter(x=>x.product_id!==id));
  const subtotal = cart.reduce((s,x)=> s + x.quantity * x.unit_price - x.discount, 0);
  const hold=()=>{
    if(!cart.length) return;
    const op=`HLD-${Date.now()}`;
    fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({branch_id:branchId, items: cart.map(c=>({product_id:c.product_id, quantity:c.quantity, discount:c.discount})), payments:[{method:'CASH',amount:subtotal}], held:true, operation_id: crypto.randomUUID()})}).then(r=>r.json()).then(j=>{
      setHeld(h=>[...h, j.sale]);
      setCart([]);
    });
  };

  const checkout=async()=>{
    if(!cart.length) return;
    setBusy(true);
    const op=crypto.randomUUID();
    const payload={
      branch_id:branchId,
      items: cart.map(c=>({product_id:c.product_id, quantity:c.quantity})),
      payments: [{method:paymentMethod, amount: subtotal, reference: paymentMethod!=='CASH' ? 'REF-'+Date.now().toString(36).toUpperCase() : undefined}],
      operation_id: op
    };
    // Offline queue: if offline, store in Dexie and show pending
    if(!isOnline){
      try{
        await db.syncQueue.add({ id: crypto.randomUUID(), operation_id: op, table_name: 'sales', operation: 'create', payload: payload as any, status: 'pending', created_at: new Date().toISOString(), retries: 0 });
        alert('Offline — sale queued with operation_id ' + op + '. Will sync when online. Server will validate stock & prevent duplicates.');
        setCart([]);
      } catch(e:any){ alert('Queue failed: '+e.message); }
      setBusy(false);
      return;
    }
    try{
      const r=await fetch("/api/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok) throw new Error(j.error ?? 'Sale failed');
      setReceiptData({ sale: j.sale, items: j.items ?? cart, total: j.saleTotal ?? subtotal, subtotal, branchId });
      setCart([]);
    }catch(e:any){ alert(e.message + " — if offline, queued. Check Sync Center."); }
    setBusy(false);
  };

  const ProductCard=({product}:{product:Product})=>(
    <button onClick={()=>addToCart(product)} disabled={product.stock===0} className="flex flex-col items-start p-3 rounded-lg border bg-card hover:bg-accent transition-colors disabled:opacity-50 text-left">
      <p className="font-medium text-sm line-clamp-2">{product.name}</p>
      <p className="text-sm text-muted-foreground">{product.sku}</p>
      <p className="text-lg font-bold mt-1">{product.price ? `UGX ${product.price.toLocaleString()}` : '—'}</p>
      <Badge variant={product.stock<10?"destructive":"secondary"} className="mt-1">Stock: {product.stock}</Badge>
    </button>
  );

  if(receiptData){
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <Receipt organization={{name:"MediFlow Demo Pharmacy", address:"Kampala Road, Kampala", phone:"+256700123456", registration_number:"REG-2024-001"}} branch={{name:"Main Branch"}} receipt_number={receiptData.sale.sale_number} sold_at={receiptData.sale.sold_at ?? new Date().toISOString()} cashier="Cashier" items={receiptData.items.map((it:any)=>({name: it.name ?? it.product_id.slice(0,8), quantity: it.quantity, unit_price: it.unit_price, discount: it.discount ?? 0, tax:0, subtotal: it.quantity*it.unit_price}))} subtotal={receiptData.subtotal} discount={0} tax={0} total={receiptData.total} payment_method={paymentMethod} footer="Thank you!" />
        <div className="flex gap-2">
          <Button onClick={printReceipt} className="flex-1"><ReceiptIcon className="h-4 w-4 mr-2"/>Print</Button>
          <Button variant="outline" onClick={()=>setReceiptData(null)} className="flex-1">New Sale</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {!isOnline && <div className="bg-yellow-500 text-white text-center text-sm py-1 flex items-center justify-center gap-2"><WifiOff className="h-4 w-4"/>OFFLINE — sales will queue locally with idempotency, will sync when online. Check Sync Center.</div>}
      <div className="flex gap-2 p-2 border-b bg-muted/20 items-center">
        <MapPin className="h-4 w-4 text-muted-foreground"/>
        <Select value={branchId} onChange={e=>setBranchId(e.target.value)} className="w-[220px]"><option value="">Select branch</option>{branches.map((b:any)=><option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</Select>
        <span className="text-xs text-muted-foreground hidden sm:inline">Server determines price/stock — browser is preview only</span>
        {!isOnline && <Badge variant="destructive"><WifiOff className="h-3 w-3 mr-1"/>Offline Queue Active</Badge>}
      </div>
      <div className="hidden md:flex flex-1">
        <div className="flex-1 flex flex-col border-r">
          <div className="p-4 border-b"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Search name/SKU/barcode..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-9"/></div></div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{[...Array(8)].map((_,i)=><Skeleton key={i} className="h-24 rounded-lg"/>)}</div>
            : <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">{filtered.map(p=> <ProductCard key={p.id} product={p}/>)}</div>}
          </div>
        </div>
        <div className="w-[380px] flex flex-col bg-card">
          <div className="p-4 border-b flex items-center justify-between"><h2 className="font-semibold flex items-center gap-2"><ShoppingCart className="h-5 w-5"/>Cart ({cart.length})</h2><div className="flex gap-2"><Button variant="outline" size="sm" onClick={hold} disabled={!cart.length}>Hold</Button>{held.length>0 && <Badge>{held.length} held</Badge>}</div></div>
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length===0 ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><ShoppingCart className="h-12 w-12 mb-4"/><p>Cart empty</p><p className="text-sm">Scan barcode or tap product</p></div>
            : <div className="space-y-3">{cart.map(it=>(
              <div key={it.product_id} className="flex items-center gap-2 p-2 rounded-lg border">
                <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{it.name}</p><p className="text-xs text-muted-foreground">UGX {it.unit_price.toLocaleString()} each</p></div>
                <div className="flex items-center gap-1"><Button variant="outline" size="icon" className="h-8 w-8" onClick={()=>updateQty(it.product_id,-1)}><Minus className="h-4 w-4"/></Button><span className="w-8 text-center">{it.quantity}</span><Button variant="outline" size="icon" className="h-8 w-8" onClick={()=>updateQty(it.product_id,1)}><Plus className="h-4 w-4"/></Button></div>
                <p className="font-medium w-20 text-right">UGX {(it.quantity*it.unit_price).toLocaleString()}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={()=>remove(it.product_id)}><Trash2 className="h-4 w-4"/></Button>
              </div>
            ))}</div>}
          </div>
          <div className="border-t p-4 space-y-3">
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>UGX {subtotal.toLocaleString()}</span></div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={paymentMethod==='CASH'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('CASH')}><Banknote className="h-4 w-4 mr-1"/>Cash</Button>
              <Button variant={paymentMethod==='MOBILE_MONEY'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('MOBILE_MONEY')}><Smartphone className="h-4 w-4 mr-1"/>Mobile</Button>
              <Button variant={paymentMethod==='CARD'?"default":"outline"} size="sm" onClick={()=>setPaymentMethod('CARD')}><CreditCard className="h-4 w-4 mr-1"/>Card</Button>
            </div>
            <Button className="w-full" size="lg" disabled={!cart.length||busy} onClick={checkout}>{busy?"Processing...":`Pay UGX ${subtotal.toLocaleString()}`}</Button>
          </div>
        </div>
      </div>
      <div className="md:hidden flex flex-col flex-1 p-4">
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input placeholder="Scan barcode..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="pl-9"/></div>
        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3">{loading ? [...Array(6)].map((_,i)=><Skeleton key={i} className="h-24 rounded-lg"/>) : filtered.map(p=> <ProductCard key={p.id} product={p}/>)}</div>
        <Sheet><SheetTrigger className="w-full mt-4"><Button className="w-full" size="lg"><ShoppingCart className="h-5 w-5 mr-2"/>View Cart ({cart.length}) UGX {subtotal.toLocaleString()}</Button></SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh]"><SheetHeader><SheetTitle>Cart</SheetTitle></SheetHeader><div className="mt-4"><Button className="w-full" size="lg" disabled={!cart.length||busy} onClick={checkout}>Pay UGX {subtotal.toLocaleString()}</Button></div></SheetContent></Sheet>
      </div>
    </div>
  );
}
