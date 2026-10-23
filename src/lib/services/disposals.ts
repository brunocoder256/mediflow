/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSB } from './supabase';

export type CreateDisposalInput = {
  branch_id: string;
  type: 'EXPIRED' | 'DAMAGED' | 'OTHER';
  product_id: string;
  batch_id: string;
  quantity: number;
  unit_cost: number;
  reason?: string;
  condition?: string;
  operation_id?: string;
};

function newOperationId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `disposal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createDisposal(input: CreateDisposalInput) {
  const sb: any = await getSB();
  const { data, error } = await sb.rpc('create_disposal', {
    p_branch_id: input.branch_id,
    p_type: input.type,
    p_product_id: input.product_id,
    p_batch_id: input.batch_id,
    p_quantity: input.quantity,
    p_unit_cost: input.unit_cost,
    p_reason: input.reason ?? null,
    p_condition: input.condition ?? null,
    p_operation_id: input.operation_id ?? newOperationId(),
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function approveDisposal(id: string) {
  const sb: any = await getSB();
  const { data, error } = await sb.rpc('approve_disposal', { p_disposal_id: id });
  if (error) throw new Error(error.message);
  return data;
}

export async function disposeStock(id: string, method?: string) {
  const sb: any = await getSB();
  const { data, error } = await sb.rpc('dispose_stock', {
    p_disposal_id: id,
    p_method: method ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getDisposals(params: { branch_id?: string; status?: string; type?: string }) {
  const sb: any = await getSB();
  let q = sb.from('disposals').select('*, products(name), product_batches(batch_number, expiry_date)').order('created_at', { ascending: false });
  if (params.branch_id) q = q.eq('branch_id', params.branch_id);
  if (params.status) q = q.eq('status', params.status);
  if (params.type) q = q.eq('type', params.type);
  const { data } = await q;
  return data ?? [];
}
