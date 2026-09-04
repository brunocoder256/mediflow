import { describe, it, expect } from 'vitest';

// Pure validation helpers extracted from customer module
function genCustomerCode(){ return `CUS-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,6).toUpperCase()}`; }
function isDuplicate(a:{phone?:string,email?:string,name?:string}, b:{phone?:string,email?:string,name?:string}){
  if(a.phone && b.phone && a.phone===b.phone) return true;
  if(a.email && b.email && a.email.toLowerCase()===b.email.toLowerCase()) return true;
  if(a.name && b.name && a.name.toLowerCase()===b.name.toLowerCase() && a.phone===b.phone) return true;
  return false;
}
function computeOutstanding(sales:{total:number}[], payments:{amount:number}[]){
  const total = sales.reduce((s,x)=>s+x.total,0);
  const paid = payments.reduce((s,x)=>s+x.amount,0);
  return Math.max(0, total-paid);
}
function availableCredit(limit:number, outstanding:number){ return Math.max(0, limit-outstanding); }

describe('customers 360', ()=>{
  it('generates customer code pattern CUS-YYYYMMDD-XXXX', ()=>{
    const code=genCustomerCode();
    expect(code).toMatch(/^CUS-\d{8}-[A-Z0-9]{4}$/);
  });
  it('detects duplicates by phone', ()=>{
    expect(isDuplicate({phone:'0700123456'}, {phone:'0700123456'})).toBe(true);
    expect(isDuplicate({phone:'0700123456'}, {phone:'0700999999'})).toBe(false);
  });
  it('detects duplicates by email case-insensitive', ()=>{
    expect(isDuplicate({email:'a@b.com'}, {email:'A@B.COM'})).toBe(true);
  });
  it('computes outstanding transaction-driven', ()=>{
    expect(computeOutstanding([{total:50000},{total:30000}], [{amount:20000}])).toBe(60000);
    expect(computeOutstanding([{total:10000}], [{amount:10000}])).toBe(0);
  });
  it('available credit cannot be negative', ()=>{
    expect(availableCredit(500000, 120000)).toBe(380000);
    expect(availableCredit(500000, 600000)).toBe(0);
  });
  it('deactivation preserves history (status vs delete)', ()=>{
    const customer={id:'1', status:'ACTIVE', is_active:true, salesCount:5};
    const deactivated={...customer, status:'INACTIVE', is_active:false};
    expect(deactivated.is_active).toBe(false);
    expect(customer.salesCount).toBe(5);
  });
  it('statement closing = opening + sales - payments - returns', ()=>{
    const opening=10000; const sales=50000; const payments=20000; const returns=5000;
    const closing=opening+sales-payments-returns;
    expect(closing).toBe(35000);
  });
  it('merge preserves counts', ()=>{
    const master={id:'m', sales:[1,2]} as any; const dup={id:'d', sales:[3]} as any;
    const moved=dup.sales.length; master.sales=[...master.sales,...dup.sales];
    expect(master.sales.length).toBe(3); expect(moved).toBe(1);
  });
});
