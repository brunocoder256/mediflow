/**
 * Centralized financial calculation utilities.
 * All calculations are server-side authoritative.
 * Amounts are in the organization's base unit (e.g., UGX) with 2 decimal places.
 */

/** Round to 2 decimal places using standard rounding */
export function roundToCents(amount: number): number {
    return Math.round(amount * 100) / 100;
}

/** Calculate line subtotal: quantity * unit_price - discount + tax */
export function calcLineSubtotal(quantity: number, unitPrice: number, discount: number = 0, tax: number = 0): number {
    const gross = quantity * unitPrice;
    const afterDiscount = gross - discount;
    const withTax = afterDiscount + tax;
    return roundToCents(withTax);
}

/** Calculate line total before tax: quantity * unit_price - discount */
export function calcLineNet(quantity: number, unitPrice: number, discount: number = 0): number {
    return roundToCents(quantity * unitPrice - discount);
}

/** Calculate line tax amount */
export function calcLineTax(netAmount: number, taxRatePercent: number): number {
    return roundToCents(netAmount * (taxRatePercent / 100));
}

/** Calculate sale subtotal (sum of all line subtotals) */
export function calcSaleSubtotal(items: Array<{ quantity: number; unit_price: number; discount: number; tax: number }>): number {
    return roundToCents(items.reduce((sum, item) => sum + calcLineSubtotal(item.quantity, item.unit_price, item.discount, item.tax), 0));
}

/** Calculate total discount across all items */
export function calcTotalDiscount(items: Array<{ quantity: number; unit_price: number; discount: number }>): number {
    return roundToCents(items.reduce((sum, item) => sum + item.discount, 0));
}

/** Calculate total tax across all items */
export function calcTotalTax(items: Array<{ quantity: number; unit_price: number; discount: number; tax: number }>): number {
    return roundToCents(items.reduce((sum, item) => sum + item.tax, 0));
}

/** Apply sale-level discount */
export function calcSaleDiscount(subtotal: number, discountPercent: number): number {
    return roundToCents(subtotal * (discountPercent / 100));
}

/** Calculate final sale total */
export function calcSaleTotal(subtotal: number, discount: number, tax: number): number {
    return roundToCents(subtotal - discount + tax);
}

/** Calculate COGS for a sale based on batch costs */
export function calcCOGS(items: Array<{ quantity: number; batch_cost: number }>): number {
    return roundToCents(items.reduce((sum, item) => sum + item.quantity * item.batch_cost, 0));
}

/** Calculate gross profit */
export function calcGrossProfit(netSales: number, cogs: number): number {
    return roundToCents(netSales - cogs);
}

/** Calculate net profit */
export function calcNetProfit(grossProfit: number, expenses: number): number {
    return roundToCents(grossProfit - expenses);
}

/** Calculate inventory value: sum of (batch_quantity * batch_cost) */
export function calcInventoryValue(batches: Array<{ quantity_available: number; purchase_price: number }>): number {
    return roundToCents(batches.reduce((sum, b) => sum + b.quantity_available * b.purchase_price, 0));
}

/** Calculate stock variance: counted - system */
export function calcVariance(systemQuantity: number, countedQuantity: number): number {
    return countedQuantity - systemQuantity;
}

/** Check if payment is fully covered */
export function checkPaymentComplete(totalDue: number, payments: Array<{ amount: number }>): boolean {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return roundToCents(totalPaid) >= roundToCents(totalDue);
}

/** Calculate payment shortfall */
export function calcPaymentShortfall(totalDue: number, payments: Array<{ amount: number }>): number {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    return roundToCents(totalDue - totalPaid);
}

/** Calculate net line amount: (quantity * unit_price) - discount + tax */
export function calcNetLineAmount(quantity: number, unitPrice: number, discount: number = 0, tax: number = 0): number {
    return roundToCents(quantity * unitPrice - discount + tax);
}

/** Format number as UGX currency string */
export function formatUGX(amount: number): string {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}