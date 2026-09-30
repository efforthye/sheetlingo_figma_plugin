export const NS = 'sheetlingo';
export const TRIAL_DAYS = 7;

/**
 * Pricing = usage-based on ONE Figma subscription:
 *   Free  → every feature, up to FREE.maxKeys distinct keys linked per file
 *   Pro   → unlimited keys (Figma native payments, single price)
 */
export const FREE = {
  maxKeys: 100, // distinct keys linked per file
  maxLanguages: Infinity,
  maxFillLayers: Infinity,
  maxCards: Infinity,
};

/** Display only — the real price is set in Figma's publish screen. Keep these in sync. */
export const PRICE = { monthly: '$3.99', yearly: '$36' };

/** Support contact (listing / help). */
export const CONTACT_EMAIL = 'efforthye@gmail.com';
