import type { PlanInfo, Tier } from '../shared/types';

let devTier: Tier | null = null;
let localFirstRun = 0;

/** Fallback trial clock when figma.payments is unavailable (e.g. dev build without payments). */
export async function loadLocalTrial() {
  localFirstRun = (await figma.clientStorage.getAsync('firstRun')) || 0;
  if (!localFirstRun) { localFirstRun = Date.now(); await figma.clientStorage.setAsync('firstRun', localFirstRun); }
}

/** Dev builds only: force a tier so free / trial / pro can all be tested. */
export async function loadDevTier() {
  if (!__DEV__) return;
  const v = await figma.clientStorage.getAsync('devTier');
  devTier = v === 'free' || v === 'trial' || v === 'pro' ? v : null;
}

export async function devSetTier(tier: Tier | null) {
  if (!__DEV__) return;
  devTier = tier;
  await figma.clientStorage.setAsync('devTier', tier ?? '');
}

function payments(): PaymentsAPI | null {
  try { return figma.payments ?? null; } catch (_) { return null; } // missing "payments" permission
}

export function getPlan(): PlanInfo {
  if (__DEV__ && devTier) return { tier: devTier, trialDaysLeft: devTier === 'trial' ? 7 : 0 };
  const p = payments();
  // No time-based trial: Free is limited by usage (linked keys), Pro = paid
  if (p && p.status.type === 'PAID') return { tier: 'pro', trialDaysLeft: 0 };
  return { tier: 'free', trialDaysLeft: 0 };
}

export const isPro = () => getPlan().tier !== 'free';

export async function upgrade() {
  const p = payments();
  if (!p) { figma.notify('Payments are not enabled for this plugin yet.'); return; }
  await p.initiateCheckoutAsync({ interstitial: 'PAID_FEATURE' });
}

