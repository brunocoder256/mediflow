import { describe, it, expect } from 'vitest';

// Simulate atomic decrement with guard quantity_available >= qty
function atomicDecrement(batches: Map<string, number>, batchId:string, qty:number): boolean{
  const avail = batches.get(batchId) ?? 0;
  if(avail < qty) return false;
  batches.set(batchId, avail - qty);
  return true;
}

describe('Idempotency', ()=>{
  it('duplicate operation_id returns same sale', ()=>{
    const seen=new Set<string>();
    const op='abc-123';
    const first= seen.has(op) ? 'duplicate' : (seen.add(op), 'created');
    const second= seen.has(op) ? 'duplicate' : (seen.add(op), 'created');
    expect(first).toBe('created'); expect(second).toBe('duplicate');
  });
  it('retry does not double stock decrement', ()=>{
    const batches=new Map([['B1',10]]);
    const opSet=new Set<string>();
    function process(op:string, qty:number){
      if(opSet.has(op)) return 'already';
      if(!atomicDecrement(batches,'B1',qty)) return 'insufficient';
      opSet.add(op); return 'ok';
    }
    expect(process('op1',3)).toBe('ok');
    expect(process('op1',3)).toBe('already');
    expect(batches.get('B1')).toBe(7);
  });
});

describe('Concurrency - same batch 5, two users sell 4', ()=>{
  it('only one succeeds with atomic guard', ()=>{
    const batches=new Map([['BATCH-A',5]]);
    const results=[atomicDecrement(batches,'BATCH-A',4), atomicDecrement(batches,'BATCH-A',4)];
    // first succeeds, second fails because only 1 left
    expect(results.filter(Boolean).length).toBe(1);
    expect(batches.get('BATCH-A')).toBe(1);
  });
  it('insufficient stock race prevented', ()=>{
    const batches=new Map([['B',2]]);
    expect(atomicDecrement(batches,'B',3)).toBe(false);
    expect(batches.get('B')).toBe(2);
  });
});
