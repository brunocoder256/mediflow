# MediFlow Business Calculation Rules

All amounts `numeric(14,2)` in PostgreSQL. Server is authoritative. Rounding: standard half-up to 2 decimals at line level then aggregate.

## Line Level
```
Line Subtotal = Quantity × Unit Price
Line Net      = Line Subtotal - Line Discount
Line Tax      = Line Net × (TaxRate / 100)   // or provided per-line tax
Line Total    = Line Net + Line Tax
```

## Sale Level
```
Sale Subtotal      = Σ Line Subtotal
Sale Total Discount= Σ Line Discount + Sale-level Discount
Sale Total Tax     = Σ Line Tax
Sale Total         = Sale Subtotal - Sale Total Discount + Sale Total Tax
Payment Total      = Σ Payment.amount
Payment Complete?  = round(Payment Total) >= round(Sale Total)
Shortfall          = Sale Total - Payment Total
```

## COGS & Profit
```
COGS per line = Quantity × Batch Purchase Price (historical, never current product cost)
Total COGS    = Σ COGS per line (if sale spans batches A,B: sum both)
Net Sales     = Sale Total - Refunds
Gross Profit  = Net Sales - COGS
Net Profit    = Gross Profit - Operating Expenses (filtered by date/branch)
```

Example batch-spanning:
```
Batch A: 5 × 2,000 = 10,000
Batch B: 3 × 2,500 = 7,500
Total COGS = 17,500
```

## Inventory
```
Inventory Value = Σ(batch.quantity_available × batch.purchase_price)
Variance        = Counted Quantity - System Quantity
Expected Stock  = Opening + Purchases - Sales + SaleReturns - Damaged - Expired ± Adjustments
Low Stock?      = quantity_available <= reorder_level
Expiring Soon?  = expiry_date <= now + expiry_warning_days
Expired?        = expiry_date <= now
```

## Purchase
```
PO Subtotal = Σ(quantity_ordered × unit_cost)
PO Total    = Subtotal - Discount + Tax
Received Remaining = quantity_ordered - quantity_received
Status: DRAFT -> ORDERED -> PARTIALLY_RECEIVED -> RECEIVED
Only RECEIVED creates batches & movements.
```

## Returns
```
Max Returnable = sold_quantity - already_returned_quantity
Refund Amount  = return_quantity × original unit price (pro-rata tax/discount)
If condition = SELLABLE: stock +movement SALE_RETURN
If DAMAGED/COMPROMISED: movement DAMAGED, no sellable stock addition
```

## Currency & Precision
- Stored as numeric(14,2), JS number for transfer, PostgreSQL for truth.
- `roundToCents(x)` = Math.round(x*100)/100
- Display via `formatCurrency` / `formatUGX` using Intl.
- Organization-configurable currency (default UGX) and timezone (Africa/Kampala).
