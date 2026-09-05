// Notification generation + queries.
// Alerts are derived live from authoritative data (low stock, expiry,
// pending purchases) and written to the `notifications` table so the bell
// reflects real inventory conditions — not mock data.
import { getSB } from '@/lib/services/supabase';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

interface AlertDraft {
  type: string;
  title: string;
  message: string;
}

/** Compute current alert drafts for an org (optionally one branch). */
async function computeAlertDrafts(orgId: string, branchId?: string | null): Promise<AlertDraft[]> {
  const sb: any = await getSB();
  const drafts: AlertDraft[] = [];

  let batchQ = sb.from('product_batches').select('product_id, quantity_available, expiry_date, products(name, reorder_level)').eq('is_active', true);
  if (branchId) batchQ = batchQ.eq('branch_id', branchId);
  const { data: batches } = await batchQ;

  const now = new Date();
  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const lowNames: string[] = [];
  const seenLow = new Set<string>();
  let expiring = 0;
  let expired = 0;
  for (const b of (batches ?? []) as any[]) {
    const level = Number(b.products?.reorder_level ?? 10);
    if (Number(b.quantity_available) <= level && !seenLow.has(b.product_id)) {
      seenLow.add(b.product_id);
      lowNames.push(b.products?.name ?? 'Item');
    }
    const d = new Date(b.expiry_date);
    if (d <= now) expired += 1;
    else if (d <= soon) expiring += 1;
  }

  if (lowNames.length) {
    const shown = lowNames.slice(0, 4);
    const more = lowNames.length - shown.length;
    drafts.push({
      type: 'low_stock',
      title: `Low stock: ${lowNames.length} item${lowNames.length === 1 ? '' : 's'}`,
      message: `${shown.join(', ')}${more > 0 ? ` +${more} more` : ''} below reorder level. Order more stock soon.`,
    });
  }
  if (expiring) {
    drafts.push({
      type: 'expiry',
      title: `Expiring soon: ${expiring} batch${expiring === 1 ? '' : 'es'}`,
      message: 'Stock expires within the next 30 days. Review and prioritize FEFO dispatch.',
    });
  }
  if (expired) {
    drafts.push({
      type: 'expired',
      title: `Expired: ${expired} batch${expired === 1 ? '' : 'es'}`,
      message: 'Mark expired stock unusable or process a return with the supplier.',
    });
  }

  let poQ = sb.from('purchase_orders').select('id').in('status', ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED']);
  if (branchId) poQ = poQ.eq('branch_id', branchId);
  const { data: pendingPO } = await poQ;
  const pending = (pendingPO ?? []).length;
  if (pending) {
    drafts.push({
      type: 'pending_purchases',
      title: `Pending purchases: ${pending}`,
      message: `${pending} purchase order${pending === 1 ? '' : 's'} awaiting receipt or order confirmation.`,
    });
  }

  return drafts;
}

/**
 * Insert fresh alerts for every active user of the org, de-duplicated against
 * existing *unread* notifications (same type + title). Returns rows inserted.
 */
export async function syncInventoryNotifications(orgId: string, branchId?: string | null): Promise<number> {
  const drafts = await computeAlertDrafts(orgId, branchId);
  if (!drafts.length) return 0;

  const admin = createAdminSupabaseClient();
  const { data: profiles } = await admin.from('profiles').select('id').eq('organization_id', orgId).eq('is_active', true);
  const userIds = (profiles ?? []).map((p: any) => p.id);
  if (!userIds.length) return 0;

  let inserted = 0;
  for (const uid of userIds) {
    for (const d of drafts) {
      const { data: existing, error: existErr } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', uid)
        .eq('type', d.type)
        .eq('title', d.title)
        .eq('is_read', false)
        .limit(1);
      if (existErr || (existing ?? []).length) continue;
      const { error } = await admin.from('notifications').insert({
        organization_id: orgId,
        user_id: uid,
        type: d.type,
        title: d.title,
        message: d.message,
      });
      if (!error) inserted += 1;
    }
  }
  return inserted;
}

export async function getNotificationsForUser(userId: string, limit = 50) {
  const sb: any = await getSB();
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  const { count: unreadCount } = await sb
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return { notifications: error ? [] : (data ?? []), unreadCount: unreadCount ?? 0 };
}

export async function markNotificationRead(userId: string, id?: string, all?: boolean) {
  const sb: any = await getSB();
  const now = new Date().toISOString();
  if (all) {
    const { error } = await sb
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .eq('user_id', userId)
      .eq('is_read', false);
    return { ok: !error, error: error?.message ?? null };
  }
  if (!id) return { ok: false, error: 'id required' };
  const { error } = await sb
    .from('notifications')
    .update({ is_read: true, read_at: now })
    .eq('id', id)
    .eq('user_id', userId);
  return { ok: !error, error: error?.message ?? null };
}