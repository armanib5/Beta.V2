/** Flat platform processing fee applied to every Stripe checkout on this
 * project (signup, Quick Boost/Top 10 Placement, Founding/Featured tier
 * upgrade) - kept in one place so the UI's displayed total and the
 * worker's actual Stripe line item can never drift apart. Mirrored in
 * worker/index.ts (a separate bundle, can't import this file directly). */
export const PLATFORM_FEE_CENTS = 100;
