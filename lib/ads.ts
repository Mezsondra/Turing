/**
 * Interstitial ads on mobile.
 *
 * Web has no ad network: AdSense refuses thin-content sites and this game has
 * almost no text on the page, so the interstitial slot sells Premium instead.
 * On native the same slot shows a real AdMob interstitial.
 *
 * ponytail: no ad-provider abstraction. There is one network on one platform;
 * an interface with a single implementation is a guess about a second one.
 */
import { Capacitor } from '@capacitor/core';

// Google's official test units. The default is deliberately the test id, not
// the live one: showing - or clicking - your own live ads on a dev build is how
// AdMob accounts get suspended, and that ban covers the account, not the app.
// Real ids come from env at build time.
const TEST_INTERSTITIAL = {
  ios: 'ca-app-pub-3940256099942544/4411468910',
  android: 'ca-app-pub-3940256099942544/1033173712',
};

const TEST_REWARDED = {
  ios: 'ca-app-pub-3940256099942544/1712485313',
  android: 'ca-app-pub-3940256099942544/5224354917',
};

export const isNative = (): boolean => Capacitor.isNativePlatform();

const interstitialId = (): string => {
  const configured = import.meta.env.VITE_ADMOB_INTERSTITIAL_ID;
  if (configured) return configured;
  return Capacitor.getPlatform() === 'ios' ? TEST_INTERSTITIAL.ios : TEST_INTERSTITIAL.android;
};

const rewardedId = (): string => {
  const configured = import.meta.env.VITE_ADMOB_REWARDED_ID;
  if (configured) return configured;
  return Capacitor.getPlatform() === 'ios' ? TEST_REWARDED.ios : TEST_REWARDED.android;
};

let initialized = false;

/** Safe to call repeatedly and on web, where it does nothing. */
export async function initAds(): Promise<void> {
  if (!isNative() || initialized) return;
  initialized = true;

  const { AdMob, AdmobConsentStatus } = await import('@capacitor-community/admob');
  await AdMob.initialize();

  // Google requires a certified CMP before serving ads to EEA/UK users, and the
  // server is in the UK, so this is the common case rather than the edge one.
  // The UMP SDK ships with the plugin and decides for itself whether a form is
  // needed - NOT_REQUIRED outside the EEA means this costs one call and no UI.
  try {
    const consent = await AdMob.requestConsentInfo();
    if (consent.status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable) {
      await AdMob.showConsentForm();
    }
  } catch (error) {
    console.warn('Consent flow unavailable:', error);
  }

  // iOS only, and after consent: Apple requires this prompt before the IDFA is
  // readable. Declining is fine and yields non-personalised ads, which still
  // pay.
  if (Capacitor.getPlatform() === 'ios') {
    try {
      const { status } = await AdMob.trackingAuthorizationStatus();
      if (status === 'notDetermined') await AdMob.requestTrackingAuthorization();
    } catch {
      // Never block the game on a consent prompt.
    }
  }
}

/**
 * Shows a rewarded video. Resolves true only if the ad ran to the point where
 * AdMob reports a reward - which is a hint for the UI, not the grant itself.
 * The rounds are credited by AdMob calling /api/ads/reward directly, because a
 * client claiming it watched an ad is not evidence of anything.
 */
export async function showRewarded(playerId: string): Promise<boolean> {
  if (!isNative()) return false;

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await initAds();
    await AdMob.prepareRewardVideoAd({
      adId: rewardedId(),
      // Carried through to the SSV callback, and the only thing tying an ad
      // view to an account.
      ssv: { customData: playerId },
    });
    const reward = await AdMob.showRewardVideoAd();
    return !!reward;
  } catch (error) {
    console.warn('Rewarded video unavailable:', error);
    return false;
  }
}

/**
 * Shows an interstitial and resolves when it is dismissed. Resolves immediately
 * on web, and on any failure - a missing fill or a network blip must not trap
 * the player in a modal they cannot leave.
 */
export async function showInterstitial(): Promise<void> {
  if (!isNative()) return;

  try {
    const { AdMob } = await import('@capacitor-community/admob');
    await initAds();
    await AdMob.prepareInterstitial({ adId: interstitialId() });
    await AdMob.showInterstitial();
  } catch (error) {
    console.warn('Interstitial unavailable:', error);
  }
}
