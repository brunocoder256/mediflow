/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { insertOne, createAuditLog, getSB } from './supabase';
import type { CreateExpenseInput } from '@/lib/validations/expenses';

export async function createExpense(input: CreateExpenseInput) {
    const sb = await getSB();
    const profileId = await import('./supabase').then(m => m.getProfileId());

    const { data, error } = await sb.from('expenses').insert({
        ...input,
        created_by: profileId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(`Failed to create expense: ${error.message}`);

    await createAuditLog('EXPENSE_CREATED', 'expenses', data.id, null, data);
    return data;
}

export async function getExpenses(params: { branch_id?: string; page?: number; perPage?: number; date_from?: string; date_to?: string }) {
    const sb = await getSB();
    const { branch_id, page = 1, perPage = 20, date_from, date_to } = params;
    let query = sb.from('expenses').select('*', { count: 'exact' });
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (date_from) query = query.gte('expense_date', date_from);
    if (date_to) query = query.lte('expense_date', date_to);
    query = query.order('expense_date', { ascending: false });
    const from = (page - 1) * perPage;
    const { data, error, count } = await query.range(from, from + perPage - 1);
    if (error) throw new Error(`Failed to fetch expenses: ${error.message}`);
    return { data, count };
}

export async function getExpenseCategories() {
    return [
        { value: 'rent', label: 'Rent' },
        { value: 'utilities', label: 'Utilities' },
        { value: 'salaries', label: 'Salaries' },
        { value: 'supplies', label: 'Supplies' },
        { value: 'maintenance', label: 'Maintenance' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'other', label: 'Other' },
    ];
}

export async function getExpenseSummary(params: { branch_id?: string; date_from?: string; date_to?: string }) {
    const sb = await getSB();
    const { branch_id, date_from, date_to } = params;
    let query = sb.from('expenses').select('amount');
    if (branch_id) query = query.eq('branch_id', branch_id);
    if (date_from) query = query.gte('expense_date', date_from);
    if (date_to) query = query.lte('expense_date', date_to);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch expense summary: ${error.message}`);
    const total = data.reduce((sum: number, item: any) => sum + item.amount, 0);
    return { total, count: data.length };
}

