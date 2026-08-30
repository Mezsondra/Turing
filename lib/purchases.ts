/**
 * In-app purchases on mobile, via RevenueCat.
 *
 * Apple and Google both require their own billing for digital goods, so Stripe
 * cannot be used inside the apps. RevenueCat sits in front of StoreKit and
 * Play Billing and reports the result to our server by webhook - the client
 * never grants its own entitlement, exactly as with Stripe on the web.
 *
 * ponytail: no purchase abstraction over the two platforms. RevenueCat already
 * is that abstraction; wrapping it again would just be a second one.
 */
import { Capacitor } from '@capacitor/core';
import { isNative } from './ads';
import type { PremiumPlan } from '../components/PremiumModal';

// Per-platform, like AdMob's: an Apple key is not valid for Google.
const apiKey = (): string | undefined =>
  Capacitor.getPlatform() === 'ios'
    ? import.meta.env.VITE_REVENUECAT_API_KEY_IOS
    : import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID;

/** Native purchasing is only offered when it can actually work. */
export const canPurchaseNatively = (): boolean => isNative() && !!apiKey();

let configuredFor: string | null = null;

/**
 * Identifies the player to RevenueCat, so its webhook can name them. The
 * app_user_id it sends back is this exact value, and it is what the server
 * writes the entitlement against.
 */
async function configure(playerId: string): Promise<void> {
  if (configuredFor === playerId) return;

  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  const key = apiKey();
  if (!key) throw new Error('RevenueCat API key is not configured for this platform');

  if (configuredFor === null) {
    await Purchases.configure({ apiKey: key, appUserID: playerId });
  } else {
    // The player signed in as somebody else on the same device.
    await Purchases.logIn({ appUserID: playerId });
  }
  configuredFor = playerId;
}

const PACKAGE_FOR: Record<PremiumPlan, string> = {
  monthly: 'MONTHLY',
  yearly: 'ANNUAL',
  lifetime: 'LIFETIME',
};

/**
 * Runs the store's purchase flow. Resolves true once the store reports a
 * purchase - which is a cue to refresh, not the entitlement itself. The
 * entitlement arrives separately, from RevenueCat calling our webhook.
 * Throws with a message worth showing; a user cancelling is not an error.
 */
export async function purchase(playerId: string, plan: PremiumPlan): Promise<boolean> {
  await configure(playerId);
  const { Purchases } = await import('@revenuecat/purchases-capacitor');

  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const wanted = packages.find((p) => p.packageType === PACKAGE_FOR[plan]);
  if (!wanted) {
    throw new Error(`The ${plan} plan is not available on this device right now.`);
  }

  try {
    await Purchases.purchasePackage({ aPackage: wanted });
    return true;
  } catch (error: any) {
    // RevenueCat reports a user-initiated cancel as an error. It is not one.
    if (error?.code === '1' || error?.userCancelled) return false;
    throw error;
  }
}

/**
 * Apple requires a visible Restore Purchases path, and it is the only way a
 * player who reinstalled or switched device gets their lifetime unlock back.
 */
export async function restore(playerId: string): Promise<boolean> {
  await configure(playerId);
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  const info = await Purchases.restorePurchases();
  return Object.keys(info.customerInfo?.entitlements?.active ?? {}).length > 0;
}
