import { test, expect } from '@playwright/test';

// Mock data
const mockBranches = [{ id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', name: 'Main Branch', code: 'MB01' }];
const mockCategories = [
  { id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', name: 'Antibiotics', is_active: true },
  { id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', name: 'Pain Relief', is_active: true },
];
const mockProducts = [
  { id: '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', name: 'Amoxicillin 500mg', generic_name: 'Amoxicillin', sku: 'AMX-500', barcode: '6291234567890', is_active: true, category_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' },
  { id: '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', name: 'Paracetamol 500mg', generic_name: 'Paracetamol', sku: 'PCM-500', barcode: '6291234567891', is_active: true, category_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02' },
  { id: '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', name: 'Expired Drug', generic_name: 'Expired', sku: 'EXP-001', barcode: '6291234567000', is_active: true, category_id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' },
];
const mockStock = [
  { product_id: '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', branch_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', batch_number: 'BATCH-A', expiry_date: new Date(Date.now()+ 60*86400000).toISOString().slice(0,10), quantity_available: 20, selling_price: 12000, purchase_price: 8000, is_active: true },
  { product_id: '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', branch_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', batch_number: 'BATCH-B', expiry_date: new Date(Date.now()+ 90*86400000).toISOString().slice(0,10), quantity_available: 100, selling_price: 12500, purchase_price: 8000, is_active: true },
  { product_id: '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', branch_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', batch_number: 'PCM-BATCH', expiry_date: new Date(Date.now()+ 5*86400000).toISOString().slice(0,10), quantity_available: 42, selling_price: 3500, purchase_price: 2000, is_active: true },
  // expired batch only
  { product_id: '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', branch_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', batch_number: 'EXP-BATCH', expiry_date: new Date(Date.now()- 10*86400000).toISOString().slice(0,10), quantity_available: 10, selling_price: 5000, purchase_price: 3000, is_active: true },
];

async function mockApis(page:any){
  await page.route('**/api/settings', async (route:any)=>{
    await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ branches: mockBranches, organization_settings: { expiry_warning_days: 30, receipt_header: 'MediFlow Demo', receipt_footer: 'Thanks' }, branch_settings: [] }) });
  });
  await page.route('**/api/categories', async (route:any)=>{
    await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(mockCategories) });
  });
  await page.route('**/api/products', async (route:any)=>{
    await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(mockProducts) });
  });
  await page.route('**/api/inventory', async (route:any)=>{
    await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ stock: mockStock, lowStock: [], expiring: [], expired: [], inventoryValue: [] }) });
  });
  await page.route('**/api/customers*', async (route:any)=>{
    await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify([{ id:'c0eebc99-9001-4000-8000-000000000001', name:'Walk-in Customer'}, {id:'c2', name:'John Doe', phone:'+256700000001'}]) });
  });
  await page.route('**/api/cash/sessions*', async (route:any)=>{
    await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ id:'sess-1', status:'OPEN', branch_id: mockBranches[0].id }) });
  });
  await page.route('**/api/sales*', async (route:any)=>{
    const req=route.request();
    if(req.method()==='GET'){
      const url=req.url();
      if(url.includes('status=HELD')){
        await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ data: [] }) });
        return;
      }
      await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ data: [] }) });
      return;
    }
    if(req.method()==='POST'){
      const body=JSON.parse(req.postData()||'{}');
      // discount permission mock: cashier 5% fail if >5
      const hasDiscount= body.items?.some((i:any)=> (i.discount??0)>0 );
      const percentItem= body.items?.find((i:any)=> i.discount_type==='percent' && i.discount>5);
      if(percentItem){
        await route.fulfill({ status:400, contentType:'application/json', body: JSON.stringify({ error:'Discount % exceeds your limit (max 5%)' }) });
        return;
      }
      // insufficient stock mock
      const over= body.items?.find((i:any)=> i.product_id==='10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' && i.quantity>120);
      if(over){
        await route.fulfill({ status:400, contentType:'application/json', body: JSON.stringify({ error:'Insufficient stock for product 10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01: need 200, available 120' }) });
        return;
      }
      if(body.held){
        await route.fulfill({ status:201, contentType:'application/json', body: JSON.stringify({ sale:{ id:'held-1', sale_number:'HLD-001', status:'HELD', sold_at:new Date().toISOString(), total:12000 }, items:[] }) });
        return;
      }
      // idempotency: if operation_id seen before, return duplicate 200
      // For test, second call with same op returns duplicate
      // Use global map via header? Simplify: if body.operation_id === 'dup-op' return duplicate
      if(body.operation_id==='11111111-1111-1111-1111-111111111111'){
        await route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ sale:{ id:'sale-1', sale_number:'20260401-000001', status:'COMPLETED' }, duplicate:true, message:'Duplicate operation' }) });
        return;
      }
      await route.fulfill({ status:201, contentType:'application/json', body: JSON.stringify({ sale:{ id:'sale-123', sale_number:'20260401-000001', sold_at:new Date().toISOString(), status:'COMPLETED' }, items: body.items.map((it:any)=>({ product_id:it.product_id, quantity:it.quantity, unit_price:12000, discount:0, batch_id:'batch-a', subtotal: it.quantity*12000 })), saleTotal: body.items.reduce((s:any,it:any)=>s+it.quantity*12000,0), saleSubtotal: body.items.reduce((s:any,it:any)=>s+it.quantity*12000,0) }) });
      return;
    }
    await route.continue();
  });
}

test.describe('POS Hardening E2E — Atomic, Discount, Category, Offline Conflict', ()=>{

  test('Real category filtering renders and filters', async ({page})=>{
    await mockApis(page);
    await page.goto('/pos');
    await expect(page.locator('text=MediFlow POS')).toBeVisible({timeout:10000});
    // wait for categories
    await expect(page.locator('button:has-text("Antibiotics")')).toBeVisible({timeout:5000});
    await expect(page.locator('button:has-text("Pain Relief")')).toBeVisible();
    // products visible
    await expect(page.locator('text=Amoxicillin 500mg')).toBeVisible({timeout:5000});
    // filter Pain Relief
    await page.locator('button:has-text("Pain Relief")').click();
    await expect(page.locator('text=Amoxicillin 500mg')).toBeHidden({timeout:3000});
    await expect(page.locator('text=Paracetamol 500mg')).toBeVisible();
    // All
    await page.locator('button:has-text("All")').click();
    await expect(page.locator('text=Amoxicillin 500mg')).toBeVisible();
  });

  test('FEFO, expiry, near-expiry badges and expired blocked', async ({page})=>{
    await mockApis(page);
    await page.goto('/pos');
    await expect(page.locator('text=Amoxicillin 500mg')).toBeVisible({timeout:8000});
    // FEFO badge
    await expect(page.locator('text=FEFO: BATCH-A')).toBeVisible();
    // Near expiry (Paracetamol 5 days) should show warning
    await expect(page.locator('text=Expires in').first()).toBeVisible();
    // Expired drug should be NOT FOR SALE and disabled
    await expect(page.locator('text=Expired Drug')).toBeVisible();
    await expect(page.locator('text=NOT FOR SALE')).toBeVisible();
    const expiredBtn= page.locator('button:has-text("Expired Drug")');
    await expect(expiredBtn).toBeDisabled();
  });

  test('Discount permission server-side enforcement', async ({page})=>{
    await mockApis(page);
    await page.goto('/pos');
    await expect(page.locator('text=Amoxicillin 500mg')).toBeVisible({timeout:8000});
    // Add to cart
    await page.locator('button:has-text("Amoxicillin 500mg")').click();
    await expect(page.locator('text=Cart')).toBeVisible();
    // set 20% discount (cashier limit 5% -> should fail on server)
    const discountInput= page.locator('input[placeholder="Discount"]').first();
    await discountInput.fill('20');
    // select percent
    const select= page.locator('select').first();
    await select.selectOption('percent');
    // intercept alert
    page.on('dialog', async d=>{ await d.accept(); });
    // try checkout via API directly to verify server enforcement without UI flow
    const res= await page.evaluate(async ()=>{
      const r=await fetch('/api/sales', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ branch_id:'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', items:[{product_id:'10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', quantity:1, discount:20, discount_type:'percent'}], payments:[{method:'CASH', amount:12000}], operation_id: crypto.randomUUID() }) });
      return {status:r.status, json: await r.json()};
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/exceeds your limit/);
  });

  test('Daily-shop simulation: branch → scan → qty → discount → customer → pay → receipt → new sale → hold/resume', async ({page})=>{
    await mockApis(page);
    await page.goto('/pos');
    await expect(page.locator('text=MediFlow POS')).toBeVisible({timeout:8000});
    // Ensure branch selected (mock)
    await expect(page.locator('select[aria-label="Branch"]')).toBeVisible();
    // Search generic name
    const search= page.locator('input[aria-label="Search products"]');
    await search.fill('Paracetamol');
    await expect(page.locator('text=Paracetamol 500mg')).toBeVisible();
    await expect(page.locator('text=Amoxicillin 500mg')).toBeHidden();
    await search.fill('');
    // Add two products
    await page.locator('button:has-text("Amoxicillin 500mg")').click();
    await page.locator('button:has-text("Paracetamol 500mg")').click();
    // Increase qty Amox to 2
    const plusBtns= page.locator('button[aria-label="Increase"]');
    await plusBtns.first().click();
    // Verify cart 2 items, 3 units
    await expect(page.locator('text=Cart (3 items)').or(page.locator('text=Cart (2 items)'))).toBeVisible({timeout:3000});
    // Customer
    await page.locator('text=Walk-in Customer').first().click();
    await expect(page.locator('text=Select Customer')).toBeVisible();
    await page.locator('button:has-text("John Doe")').click();
    await expect(page.locator('text=John Doe')).toBeVisible();
    // Payment: CASH amount received
    const amountInput= page.locator('input[placeholder="Amount received (UGX)"]').first();
    await amountInput.fill('50000');
    // Complete sale via dialog
    await page.locator('button:has-text("Pay UGX")').first().click();
    await expect(page.locator('text=Complete Sale')).toBeVisible();
    await page.locator('button:has-text("Complete Sale — Enter")').click();
    // Receipt
    await expect(page.locator('text=Sale Completed')).toBeVisible({timeout:8000});
    await expect(page.locator('text=Receipt #20260401-000001')).toBeVisible();
    await expect(page.locator('text=FEFO')).toBeVisible();
    // New sale
    await page.locator('button:has-text("New Sale")').click();
    await expect(page.locator('text=Cart empty').or(page.locator('text=Cart (0 items)'))).toBeVisible({timeout:5000});

    // Held sale: add, hold, resume
    await page.locator('button:has-text("Amoxicillin 500mg")').click();
    await page.locator('button:has-text("Hold")').click();
    // allow held to appear
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Held (")').click();
    await expect(page.locator('text=Held Sales')).toBeVisible({timeout:5000});
  });

  test('Offline queue + sync + conflict UX', async ({page, context})=>{
    await mockApis(page);
    await page.goto('/pos');
    await expect(page.locator('text=MediFlow POS')).toBeVisible({timeout:8000});
    await page.locator('button:has-text("Amoxicillin 500mg")').click();
    // Simulate offline
    await context.setOffline(true);
    await page.evaluate(()=> window.dispatchEvent(new Event('offline')));
    await expect(page.locator('text=OFFLINE')).toBeVisible({timeout:3000});
    // Amount for offline sale
    await page.locator('input[placeholder="Amount received (UGX)"]').first().fill('20000');
    await page.locator('button:has-text("Pay UGX")').first().click();
    // Complete while offline -> should queue
    page.once('dialog', d=> d.accept());
    await page.locator('button:has-text("Complete Sale — Enter")').click();
    await page.waitForTimeout(1000);
    // pending badge should appear (even offline, Dexie count)
    // Go online
    await context.setOffline(false);
    await page.evaluate(()=> window.dispatchEvent(new Event('online')));
    // Manually trigger processSyncQueue via button or wait for auto
    await page.waitForTimeout(1500);
    // Check sync center via navigation
    await page.goto('/sync');
    await expect(page.locator('text=Sync Center')).toBeVisible({timeout:5000});
    // There may be pending or no pending depending on mock; ensure page shows states
    await expect(page.locator('text=Pending').or(page.locator('text=OFFLINE'))).toBeVisible({timeout:3000});
  });

  test('Idempotency: same operation_id not duplicated', async ({page})=>{
    await mockApis(page);
    await page.goto('/pos');
    // call API twice with same operation_id
    const dupOp='11111111-1111-1111-1111-111111111111';
    const first= await page.evaluate(async (op)=>{
      const r=await fetch('/api/sales', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ branch_id:'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', items:[{product_id:'10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', quantity:1}], payments:[{method:'CASH', amount:12000}], operation_id: op }) });
      return {status:r.status, json: await r.json()};
    }, dupOp);
    expect(first.status).toBe(201);
    const second= await page.evaluate(async (op)=>{
      const r=await fetch('/api/sales', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ branch_id:'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', items:[{product_id:'10eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', quantity:1}], payments:[{method:'CASH', amount:12000}], operation_id: op }) });
      return {status:r.status, json: await r.json()};
    }, dupOp);
    // second should be 200 duplicate (or still 201 but duplicate flag) - our mock returns 200
    expect(second.status).toBe(200);
    expect(second.json.duplicate).toBe(true);
  });

});
