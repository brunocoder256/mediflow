export type TrialGate = {
  organization_id: string | null;
  organization_name: string | null;
  status: string;
  plan: string;
  trial_ends_at: string | null;
  trial_days: number;
  contact_phone_1: string;
  contact_phone_2: string;
};

export function isTrialActive(gate: TrialGate | null): boolean {
  return !!gate && gate.status === 'active' && gate.plan === 'trial';
}

export function daysLeftInTrial(gate: TrialGate | null): number {
  if (!isTrialActive(gate) || !gate?.trial_ends_at) return 0;
  const ms = new Date(gate.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}