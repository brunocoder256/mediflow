import { NextResponse } from 'next/server';
import { getSessions, openCashSession, closeCashSession, getSessionSummary, approveCashSession, getCurrentSession } from '@/lib/services/cash';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('current') === 'true') {
    const data = await getCurrentSession(searchParams.get('branch_id') ?? undefined);
    return NextResponse.json(data);
  }
  if (searchParams.get('summary')) {
    const data = await getSessionSummary(searchParams.get('summary')!);
    return NextResponse.json(data);
  }
  const data = await getSessions({
    branch_id: searchParams.get('branch_id') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    page: Number(searchParams.get('page') ?? 1),
    perPage: Number(searchParams.get('perPage') ?? 20),
  });
  return NextResponse.json(data);
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === 'open') {
      const data = await openCashSession(body);
      return NextResponse.json(data);
    }
    if (body.action === 'close') {
      const data = await closeCashSession({ session_id: body.session_id, closing_cash: body.closing_cash, notes: body.notes });
      return NextResponse.json(data);
    }
    if (body.action === 'approve') {
      const data = await approveCashSession(body.session_id, body.notes);
      return NextResponse.json(data);
    }
    if (body.action === 'movement') {
      const { addCashMovement } = await import('@/lib/services/cash');
      const data = await addCashMovement(body);
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
