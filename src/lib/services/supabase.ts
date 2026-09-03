/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

let _sb: ReturnType<typeof createServerSupabaseClient> | null = null;

export async function getSB() {
    if (!_sb) {
        _sb = createServerSupabaseClient();
    }
    return _sb;
}

export async function getProfileId(): Promise<string | null> {
    const sb = await getSB();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await sb.from('profiles').select('id').eq('auth_user_id', user.id).single();
    if (error) return null;
    return data?.id ?? null;
}

export async function getOrgId(): Promise<string | null> {
    const sb = await getSB();
    const profileId = await getProfileId();
    if (!profileId) return null;
    const { data, error } = await sb.from('profiles').select('organization_id').eq('id', profileId).single();
    if (error) return null;
    return data?.organization_id ?? null;
}

export async function insertOne<T>(table: string, data: Record<string, unknown>): Promise<T | null> {
    const sb = await getSB();
    const { data: result, error } = await sb.from(table).insert(data).select().single();
    if (error) throw new Error(`Failed to insert into ${table}: ${error.message}`);
    return result;
}

export async function updateOne<T>(table: string, id: string, data: Record<string, unknown>): Promise<T | null> {
    const sb = await getSB();
    const { data: result, error } = await sb.from(table).update(data).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update ${table}: ${error.message}`);
    return result;
}

export async function deleteOne(table: string, id: string): Promise<boolean> {
    const sb = await getSB();
    const { error } = await sb.from(table).delete().eq('id', id);
    if (error) throw new Error(`Failed to delete from ${table}: ${error.message}`);
    return true;
}

export async function getOne<T>(table: string, id: string): Promise<T | null> {
    const sb = await getSB();
    const { data, error } = await sb.from(table).select('*').eq('id', id).single();
    if (error) return null;
    return data;
}

export async function createAuditLog(action: string, entity_type: string, entity_id: string | null, old_values: Record<string, unknown> | null, new_values: Record<string, unknown> | null): Promise<void> {
    const sb = await getSB();
    const profileId = await getProfileId();
    await sb.from('audit_logs').insert({
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        created_by: profileId,
    }).select();
}

export function generateTransactionNumber(prefix: string): string {
    const date = formatDate(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${date}-${random}`;
}

