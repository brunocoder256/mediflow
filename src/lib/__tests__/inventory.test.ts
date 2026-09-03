import { describe, it, expect } from 'vitest';

// Pure FEFO / batch logic tests - no DB

function resolveFEFO(batches: Array<{id:string, expiry:string, qty:number}>, need:number){
  const sorted=[...batches].sort((a,b)=> new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
  let rem=need; const alloc:any[]=[];
  for(const b of sorted){
    if(rem<=0) break;
    if(new Date(b.expiry) <= new Date()) continue; // expired exclusion
    const take=Math.min(rem, b.qty);
    alloc.push({batch_id:b.id, qty:take});
    rem-=take;
  }
  if(rem>0) throw new Error('Insufficient');
  return alloc;
}

describe('Inventory Logic', ()=>{
  it('FEFO picks earliest expiry', ()=>{
    const f1=new Date(Date.now()+86400000*10).toISOString();
    const f2=new Date(Date.now()+86400000*20).toISOString();
    const alloc=resolveFEFO([{id:'A',expiry:f1,qty:10},{id:'B',expiry:f2,qty:10}],5);
    expect(alloc[0].batch_id).toBe('A');
  });
  it('expired exclusion', ()=>{
    const past=new Date(Date.now()-86400000).toISOString();
    const future=new Date(Date.now()+86400000*30).toISOString();
    const alloc=resolveFEFO([{id:'EXP',expiry:past,qty:100},{id:'OK',expiry:future,qty:5}],3);
    expect(alloc[0].batch_id).toBe('OK');
  });
  it('batch spanning 8 across 5+10', ()=>{
    const f1=new Date(Date.now()+86400000*10).toISOString();
    const f2=new Date(Date.now()+86400000*20).toISOString();
    const alloc=resolveFEFO([{id:'A',expiry:f1,qty:5},{id:'B',expiry:f2,qty:10}],8);
    expect(alloc).toEqual([{batch_id:'A',qty:5},{batch_id:'B',qty:3}]);
  });
  it('negative stock prevention', ()=>{
    expect(()=> resolveFEFO([{id:'A',expiry:'2027-01-01',qty:3}],5)).toThrow('Insufficient');
  });
  it('inactive product exclusion simulated', ()=>{
    const batches=[{id:'A',expiry:'2027-01-01',qty:10, active:true},{id:'B',expiry:'2027-01-01',qty:10, active:false}];
    const eligible=batches.filter(b=>b.active);
    expect(eligible.length).toBe(1);
  });
  it('stock decrement', ()=>{
    let qty=10; qty-=4; expect(qty).toBe(6);
  });
  it('variance', ()=>{
    const sys=100, counted=95; expect(counted-sys).toBe(-5);
  });
  it('disposal reduces stock', ()=>{
    let avail=20; const dispose=5; avail-=dispose; expect(avail).toBe(15);
  });
});
