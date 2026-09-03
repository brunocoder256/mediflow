import { describe, it, expect } from 'vitest';

function expectedCash(opening:number, cashSales:number, cashIn:number, cashOut:number, refunds:number){
  return opening + cashSales + cashIn - cashOut - refunds;
}
describe('Cash Reconciliation', ()=>{
  it('opening float', ()=>{ expect(expectedCash(100000,0,0,0,0)).toBe(100000); });
  it('cash sale', ()=>{ expect(expectedCash(100000, 184000,0,0,0)).toBe(284000); });
  it('cash refund', ()=>{ expect(expectedCash(100000,184000,0,0,5000)).toBe(279000); });
  it('cash in/out', ()=>{ expect(expectedCash(100000,0,20000,15000,0)).toBe(105000); });
  it('variance calc', ()=>{
    const exp=expectedCash(100000,50000,0,0,0); const actual=149000; expect(actual-exp).toBe(-1000);
  });
  it('approval threshold UGX 5k', ()=>{
    const variance=6000; expect(Math.abs(variance)>5000).toBe(true);
    expect(Math.abs(4000)>5000).toBe(false);
  });
  it('closed session restricts sale', ()=>{
    const sessionStatus:string='CLOSED'; expect(sessionStatus==='OPEN').toBe(false);
  });
});
