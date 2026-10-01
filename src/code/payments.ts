import type { PlanInfo, Tier } from '../shared/types';

let devTier: Tier | null = null;
let localFirstRun = 0;
let wasPro = false;

/** Remembers that Pro was active once, so the UI can say "your Pro ended" instead of "limit exceeded". */
export async function loadWasPro() {
  wasPro = !!(await figma.clientStorage.getAsync('wasPro'));
}
function markPro() {
  if (wasPro) return;
  wasPro = true;
  figma.clientStorage.setAsync('wasPro', true).catch(() => {});
}

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
  if (__DEV__ && devTier) {
    if (devTier !== 'free') markPro();
    return { tier: devTier, trialDaysLeft: devTier === 'trial' ? 7 : 0, wasPro };
  }
  const p = payments();
  // Free is limited by usage (linked keys). Pro = an active Figma subscription, including Figma's own trial.
  if (p && p.status.type === 'PAID') { markPro(); return { tier: 'pro', trialDaysLeft: 0, wasPro: true }; }
  return { tier: 'free', trialDaysLeft: 0, wasPro };
}

export const isPro = () => getPlan().tier !== 'free';

export async function upgrade() {
  const p = payments();
  if (!p) { figma.notify('Payments are not enabled for this plugin yet.'); return; }
  const t0 = Date.now();
  try { await p.initiateCheckoutAsync({ interstitial: 'PAID_FEATURE' }); }
  catch (_) { /* fall through to the notice below */ }
  // Development copies (imported from manifest) can't open Figma's checkout: it returns at once with no change.
  if (p.status.type !== 'PAID' && Date.now() - t0 < 800) {
    figma.notify('Checkout opens in the Community version of Sheetlingo. This is a development copy.', { timeout: 5000 });
  }
}

