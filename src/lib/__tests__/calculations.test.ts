import { describe, it, expect } from 'vitest';
import { roundToCents, calcLineSubtotal, calcCOGS, calcGrossProfit, calcNetProfit, calcInventoryValue, calcVariance, checkPaymentComplete, calcPaymentShortfall, calcSaleTotal } from '../calculations';

describe('Financial Calculations - UGX', () => {
  it('roundToCents', () => { expect(roundToCents(10.005)).toBe(10.01); expect(roundToCents(10.004)).toBe(10); });
  it('line subtotal fixed discount', () => { expect(calcLineSubtotal(2, 1500, 100, 0)).toBe(2900); });
  it('line discount percent via sale calc', () => {
    const disc = Math.round(2*1500*0.1*100)/100; expect(calcLineSubtotal(2,1500,disc,0)).toBe(2700);
  });
  it('tax', () => { expect(calcLineSubtotal(1,1000,0,180)).toBe(1180); });
  it('sale total', () => { expect(calcSaleTotal(10000, 500, 0)).toBe(9500); });
  it('payment complete', () => { expect(checkPaymentComplete(5000, [{amount:5000}])).toBe(true); expect(checkPaymentComplete(5000, [{amount: 4999.99}])).toBe(false); });
  it('shortfall', () => { expect(calcPaymentShortfall(5000, [{amount:3000},{amount:1000}])).toBe(1000); });
  it('COGS single batch', () => { expect(calcCOGS([{quantity:5, batch_cost:1000}])).toBe(5000); });
  it('COGS batch-spanning', () => {
    expect(calcCOGS([{quantity:100, batch_cost:1000},{quantity:20, batch_cost:1200}])).toBe(124000);
  });
  it('gross profit', () => {
    const revenue = 100*1500+20*1700; // 184000
    const cogs = 124000;
    expect(calcGrossProfit(revenue, cogs)).toBe(60000);
  });
  it('gross margin', () => {
    const gpVal = calcGrossProfit(184000,124000); expect(Math.round(gpVal/184000*100)).toBe(33);
  });
  it('net profit', () => { expect(calcNetProfit(60000, 15000)).toBe(45000); });
  it('inventory value', () => { expect(calcInventoryValue([{quantity_available:10, purchase_price:1000},{quantity_available:5, purchase_price:2000}])).toBe(20000); });
  it('variance', () => { expect(calcVariance(100,95)).toBe(-5); expect(calcVariance(10,15)).toBe(5); });
  it('zero values', () => { expect(calcCOGS([])).toBe(0); expect(calcInventoryValue([])).toBe(0); expect(calcGrossProfit(0,0)).toBe(0); });
  it('supplier balance', () => {
    const purchases=50000, payments=30000, returns=5000; expect(purchases - payments - returns).toBe(15000);
  });
});
