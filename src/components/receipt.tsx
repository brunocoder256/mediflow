"use client";
import * as React from "react";
import { formatCurrency } from "@/lib/utils";

type ReceiptProps = {
  organization: { name: string; address?: string; phone?: string; registration_number?: string };
  branch: { name: string; address?: string; phone?: string };
  receipt_number: string;
  sold_at: string;
  cashier: string;
  customer?: string;
  items: Array<{ name: string; quantity: number; unit_price: number; discount: number; tax: number; subtotal: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string;
  payment_reference?: string;
  currency?: string;
  footer?: string;
};

export function Receipt({ organization, branch, receipt_number, sold_at, cashier, customer, items, subtotal, discount, tax, total, payment_method, payment_reference, currency='UGX', footer }: ReceiptProps) {
  const date = new Date(sold_at);
  return (
    <div id="receipt" className="bg-white text-black p-4 max-w-[80mm] mx-auto font-mono text-xs leading-tight print:shadow-none">
      <div className="text-center border-b border-dashed pb-2 mb-2">
        <h2 className="font-bold text-sm uppercase">{organization.name}</h2>
        <p>{branch.name}</p>
        <p>{organization.address ?? branch.address}</p>
        <p>{organization.phone ?? branch.phone}</p>
        {organization.registration_number && <p>TIN: {organization.registration_number}</p>}
      </div>
      <div className="flex justify-between text-[11px] mb-2">
        <span>Receipt: {receipt_number}</span>
        <span>{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
      </div>
      <div className="text-[11px] mb-2">
        <p>Cashier: {cashier}</p>
        {customer && <p>Customer: {customer}</p>}
        <p>Payment: {payment_method}{payment_reference ? ` (${payment_reference})` : ''}</p>
      </div>
      <table className="w-full border-y border-dashed py-1 mb-2">
        <thead><tr className="text-left"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
        <tbody>{items.map((it,i)=>(
          <tr key={i}><td className="pr-1">{it.name}</td><td className="text-right">{it.quantity}</td><td className="text-right">{formatCurrency(it.unit_price, currency)}</td><td className="text-right">{formatCurrency(it.subtotal, currency)}</td></tr>
        ))}</tbody>
      </table>
      <div className="space-y-1 text-right">
        <p>Subtotal: {formatCurrency(subtotal, currency)}</p>
        {discount>0 && <p>Discount: -{formatCurrency(discount, currency)}</p>}
        {tax>0 && <p>Tax: {formatCurrency(tax, currency)}</p>}
        <p className="font-bold text-sm border-t border-dashed pt-1">TOTAL: {formatCurrency(total, currency)}</p>
      </div>
      <div className="text-center mt-3 border-t border-dashed pt-2">
        <p>{footer ?? 'Thank you for your purchase!'}</p>
        <p className="text-[10px]">Return policy: Within 24hrs with receipt</p>
        <p className="text-[10px] mt-1">[EFRIS QR placeholder]</p>
      </div>
      <style>{`@media print { body * { visibility: hidden } #receipt, #receipt * { visibility: visible } #receipt { position:absolute; left:0; top:0; width:80mm } }`}</style>
    </div>
  );
}
export function printReceipt(){ if(typeof window!=='undefined') window.print(); }
