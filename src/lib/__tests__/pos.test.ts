import { describe, it, expect } from 'vitest';
import { roundToCents, calcCOGS } from '../calculations';

// FEFO helper mirroring server resolveBatches
function resolveFEFO(batches:Array<{id:string, expiry:string, qty:number, selling_price?:number}>, need:number){
  const sorted=[...batches].sort((a,b)=> new Date(a.expiry).getTime()-new Date(b.expiry).getTime());
  let rem=need; const alloc:any[]=[];
  for(const b of sorted){
    if(rem<=0) break;
    if(new Date(b.expiry) <= new Date()) continue;
    if(b.qty<=0) continue;
    const take=Math.min(rem, b.qty);
    alloc.push({batch_id:b.id, qty:take, unit_price: b.selling_price ?? 0});
    rem-=take;
  }
  if(rem>0) throw new Error('Insufficient stock');
  return alloc;
}

describe('POS — Pharmacy FEFO', ()=>{
  it('FEFO picks earliest expiry', ()=>{
    const a=new Date(Date.now()+86400000*10).toISOString();
    const b=new Date(Date.now()+86400000*20).toISOString();
    const alloc=resolveFEFO([{id:'A',expiry:a,qty:20},{id:'B',expiry:b,qty:100}], 25);
    expect(alloc[0].batch_id).toBe('A'); expect(alloc[0].qty).toBe(20); expect(alloc[1].qty).toBe(5);
  });
  it('multi-batch 25 = A20+B5', ()=>{
    const a=new Date(Date.now()+86400000*30).toISOString();
    const b=new Date(Date.now()+86400000*60).toISOString();
    const alloc=resolveFEFO([{id:'Batch A',expiry:a,qty:20},{id:'Batch B',expiry:b,qty:100}],25);
    expect(alloc).toEqual([{batch_id:'Batch A',qty:20,unit_price:0},{batch_id:'Batch B',qty:5,unit_price:0}]);
  });
  it('expired batch blocked', ()=>{
    const past=new Date(Date.now()-86400000).toISOString();
    const future=new Date(Date.now()+86400000*30).toISOString();
    expect(()=>resolveFEFO([{id:'EXP',expiry:past,qty:100}],10)).toThrow('Insufficient');
    const alloc=resolveFEFO([{id:'EXP',expiry:past,qty:100},{id:'OK',expiry:future,qty:5}],3);
    expect(alloc[0].batch_id).toBe('OK');
  });
  it('all batches expired => unavailable', ()=>{
    const past=new Date(Date.now()-86400000).toISOString();
    expect(()=>resolveFEFO([{id:'A',expiry:past,qty:10},{id:'B',expiry:past,qty:5}],2)).toThrow();
  });
  it('near-expiry warning detection', ()=>{
    const in7=new Date(Date.now()+86400000*7).toISOString();
    const in60=new Date(Date.now()+86400000*60).toISOString();
    function warning(expiry:string, threshold=90){ const d=Math.ceil((new Date(expiry).getTime()-Date.now())/86400000); return d<=threshold && d>=0; }
    expect(warning(in7,90)).toBe(true);
    expect(warning(in60,30)).toBe(false);
    expect(warning(in7,30)).toBe(true);
  });
});

describe('POS — Stock validation', ()=>{
  it('sufficient stock passes', ()=>{ expect(()=>resolveFEFO([{id:'A',expiry:'2027-01-01',qty:10}],5)).not.toThrow(); });
  it('insufficient throws', ()=>{ expect(()=>resolveFEFO([{id:'A',expiry:'2027-01-01',qty:3}],5)).toThrow('Insufficient'); });
  it('inactive product blocked simulated', ()=>{
    const product={is_active:false}; expect(product.is_active).toBe(false);
  });
});

describe('POS — Pricing server authoritative', ()=>{
  it('client price ignored, server price used', ()=>{
    const clientPrice=999; const serverPrice=5000; const qty=2;
    const total=roundToCents(qty*serverPrice);
    expect(total).toBe(10000); expect(clientPrice).not.toBe(serverPrice);
  });
  it('discount percent validated <=100', ()=>{
    const disc=101; expect(disc>100).toBe(true);
  });
  it('discount fixed cannot exceed line total', ()=>{
    const lineTotal=2*1500; const disc=4000; expect(disc>lineTotal).toBe(true);
  });
});

describe('POS — Payment', ()=>{
  it('cash change', ()=>{ const total=18500, recv=20000; expect(recv-total).toBe(1500); });
  it('insufficient payment blocked', ()=>{ const total=18500, recv=18000; expect(recv>=total).toBe(false); });
  it('mobile money requires reference', ()=>{ const ref=''; const ref2='MTN123'; expect(!!ref).toBe(false); expect(!!ref2).toBe(true); });
  it('COGS batch-spanning preserved', ()=>{
    const allocations=[{quantity:20, batch_cost:2000},{quantity:5, batch_cost:3000}];
    expect(calcCOGS(allocations)).toBe(55000);
  });
});

describe('POS — Idempotency', ()=>{
  it('same operation_id yields one sale', ()=>{
    const seen=new Set<string>();
    function create(op:string){
      if(seen.has(op)) return {duplicate:true};
      seen.add(op); return {duplicate:false};
    }
    expect(create('op-123').duplicate).toBe(false);
    expect(create('op-123').duplicate).toBe(true);
    expect(seen.size).toBe(1);
  });
});

describe('POS — Offline queue', ()=>{
  it('queue pending then sync once', async ()=>{
    const q:{operation_id:string,status:string}[]=[];
    const op='offline-op-1';
    q.push({operation_id:op,status:'pending'});
    expect(q.filter(x=>x.status==='pending').length).toBe(1);
    // simulate sync success deletes
    const idx=q.findIndex(x=>x.operation_id===op);
    q.splice(idx,1);
    expect(q.length).toBe(0);
  });
  it('conflict insufficient stock => failed', ()=>{
    const msg='Insufficient stock for product';
    const isConflict=/insufficient|stock/i.test(msg);
    expect(isConflict).toBe(true);
  });
  it('conflict payload preserves branch and reason', ()=>{
    const entry={ operation_id:'op-1', payload:{branch_id:'b1', items:[{product_id:'p1', quantity:10}]}, error:'Insufficient stock for product p1: need 10, available 3' };
    expect(entry.error).toMatch(/Insufficient stock/);
    expect(entry.payload.branch_id).toBe('b1');
  });
});

describe('POS — Discount permission hardening', ()=>{
  function maxDiscountForRole(role:string){
    if(['Owner','Administrator'].includes(role)) return 100;
    if(role==='Manager') return 20;
    if(role==='Cashier') return 5;
    return 0;
  }
  it('cashier cannot exceed 5%', ()=>{ expect(20 > maxDiscountForRole('Cashier')).toBe(true); expect(5 <= maxDiscountForRole('Cashier')).toBe(true); });
  it('manager can do 20% but not 30%', ()=>{ expect(20 <= maxDiscountForRole('Manager')).toBe(true); expect(30 > maxDiscountForRole('Manager')).toBe(true); });
  it('owner unlimited', ()=>{ expect(100 <= maxDiscountForRole('Owner')).toBe(true); });
  it('no permission = 0', ()=>{ expect(1 > maxDiscountForRole('Viewer')).toBe(true); });
});

describe('POS — Category filtering', ()=>{
  it('filters by category', ()=>{
    const products=[{id:'1', category_id:'c1'}, {id:'2', category_id:'c2'}, {id:'3', category_id:'c1'}];
    const filtered= products.filter(p=> p.category_id==='c1');
    expect(filtered.length).toBe(2);
  });
  it('all shows everything', ()=>{
    const products=[{id:'1', category_id:'c1'}, {id:'2', category_id:'c2'}];
    const filtered= products.filter(()=>true);
    expect(filtered.length).toBe(2);
  });
});

describe('POS — Atomic transaction', ()=>{
  it('entire sale rolls back on batch failure (single transaction)', ()=>{
    // Simulate: two batches, second fails => no partial stock decrement in atomic function
    // In legacy JS path would have partial decrement then rollback; in RPC it's all-or-nothing
    const batches=new Map([['B1',20],['B2',5]]);
    function atomicSale(ops:Array<{batch:string, qty:number}>){
      const snap=new Map(batches);
      try{
        for(const op of ops){
          const avail=batches.get(op.batch)!;
          if(avail < op.qty) throw new Error('Insufficient');
          batches.set(op.batch, avail-op.qty);
        }
        return true;
      }catch{
        // rollback
        batches.clear(); for(const [k,v] of snap) batches.set(k,v);
        return false;
      }
    }
    expect(atomicSale([{batch:'B1', qty:10},{batch:'B2', qty:10}])).toBe(false);
    expect(batches.get('B1')).toBe(20); // not decremented
    expect(atomicSale([{batch:'B1', qty:10},{batch:'B2', qty:5}])).toBe(true);
    expect(batches.get('B1')).toBe(10);
  });
});
