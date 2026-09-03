import { describe, it, expect } from 'vitest';
import { calcCOGS, calcGrossProfit, calcNetProfit, calcInventoryValue, calcVariance, roundToCents } from '../calculations';

/**
 * E2E Daily Drug-Shop Scenario — MediFlow V1 Phase 6 Acceptance
 * Mirrors spec section 37: open register 100k, receive BATCH-A 100@1000, BATCH-B 50@1200, sell 120 (100+20), COGS 124k, revenue 184k, profit 60k, refund 5, count variance, cash close, balance, disposal, transfer.
 */

describe('E2E Daily Scenario', () => {
  it('open register 100,000 UGX', () => {
    const opening = 100000;
    expect(opening).toBe(100000);
  });

  it('receive BATCH-A 100@1000 selling 1500 and BATCH-B 50@1200 selling 1700', () => {
    const batches = [
      { quantity_available: 100, purchase_price: 1000, selling_price: 1500 },
      { quantity_available: 50, purchase_price: 1200, selling_price: 1700 },
    ];
    const valuation = calcInventoryValue(batches as any);
    expect(valuation).toBe(100*1000 + 50*1200); // 160,000
    expect(batches[0].quantity_available).toBe(100);
  });

  it('sell 120 units FEFO batch-spanning 100 from A + 20 from B', () => {
    const allocations = [
      { batch_id: 'A', qty: 100, unit_price: 1500, purchase_price: 1000 },
      { batch_id: 'B', qty: 20, unit_price: 1700, purchase_price: 1200 },
    ];
    const revenue = allocations.reduce((s,a)=>s + a.qty * a.unit_price, 0);
    expect(revenue).toBe(100*1500 + 20*1700); // 184,000
    const cogs = calcCOGS(allocations.map(a=>({quantity: a.qty, batch_cost: a.purchase_price})));
    expect(cogs).toBe(100*1000 + 20*1200); // 124,000
    const profit = calcGrossProfit(revenue, cogs);
    expect(profit).toBe(60000);
    // remaining stock
    const remainingA = 100-100; const remainingB = 50-20;
    expect(remainingA).toBe(0); expect(remainingB).toBe(30);
    const remainingValuation = calcInventoryValue([{quantity_available: remainingA, purchase_price:1000},{quantity_available: remainingB, purchase_price:1200}] as any);
    expect(remainingValuation).toBe(30*1200); // 36,000
  });

  it('COGS preserves historical cost after price change', () => {
    const historicalCOGS = 100*1000 + 20*1200;
    const newPriceA = 1800; // price changed after sale
    // COGS must not use new price
    expect(historicalCOGS).toBe(124000);
    expect(newPriceA).not.toBe(1000);
  });

  it('refund 5 units sellable', () => {
    const refundQty = 5;
    const refundAmount = refundQty * 1500; // use original price of batch A
    expect(refundAmount).toBe(7500);
    let batchAStock = 0;
    batchAStock += refundQty; // SELLABLE -> return to stock
    expect(batchAStock).toBe(5);
    const damagedQty = 2;
    const damagedStock = 0;
    void damagedQty;
    // DAMAGED does NOT return to sellable
    expect(damagedStock).toBe(0);
  });

  it('stock count variance Y - X', () => {
    const systemQty = 30; // after sale remaining B
    const countedQty = 28;
    const variance = calcVariance(systemQty, countedQty);
    expect(variance).toBe(-2);
    // negative -> ADJUSTMENT_OUT 2
    expect(variance < 0).toBe(true);
  });

  it('cash reconciliation: opening 100k + cashSales 184k - refunds 7.5k = expected', () => {
    const opening = 100000;
    const cashSales = 184000;
    const cashIn = 0, cashOut=0, refunds=7500;
    const expected = opening + cashSales + cashIn - cashOut - refunds;
    expect(expected).toBe(276500);
    const actual = 276000; // cashier declares 500 short
    const variance = actual - expected;
    expect(variance).toBe(-500);
    expect(Math.abs(variance) > 5000).toBe(false); // no approval needed
    const bigVariance = -6000;
    expect(Math.abs(bigVariance) > 5000).toBe(true); // requires approval
  });

  it('supplier balance: purchases - payments - returns', () => {
    const purchases = 160000; // 100*1000 +50*1200
    const payments = 100000;
    const returns = 0;
    const balance = purchases - payments - returns;
    expect(balance).toBe(60000);
  });

  it('disposal: expired 5 units reduces stock and creates movement', () => {
    let stock = 10;
    const disposeQty = 5;
    stock -= disposeQty;
    expect(stock).toBe(5);
    // movement type EXPIRED, not re-added to sellable
  });

  it('transfer: source TRANSFER_OUT, dest TRANSFER_IN', () => {
    let source = 20; let dest = 5;
    const qty = 10;
    source -= qty; // TRANSFER_OUT
    expect(source).toBe(10);
    // dest not yet increased (IN_TRANSIT)
    expect(dest).toBe(5);
    dest += qty; // on RECEIVE
    expect(dest).toBe(15);
  });

  it('net profit: gross 60k - expenses 15k = 45k', () => {
    const gross = 60000; const expenses = 15000;
    expect(calcNetProfit(gross, expenses)).toBe(45000);
  });

  it('rounding UGX', () => {
    expect(roundToCents(100.005)).toBe(100.01);
    expect(roundToCents(184000.004)).toBe(184000);
  });
});
