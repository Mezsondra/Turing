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

/**
 * AdMob ad unit ids are per-platform - an Android unit id is meaningless on
 * iOS and simply never fills. Each platform needs its own env var, written out
 * literally because vite substitutes `import.meta.env.X` at build time and
 * cannot resolve a computed key.
 */
const unitId = (
  ios: string | undefined,
  android: string | undefined,
  test: { ios: string; android: string }
): string =>
  Capacitor.getPlatform() === 'ios' ? ios || test.ios : android || test.android;

const interstitialId = (): string =>
  unitId(
    import.meta.env.VITE_ADMOB_INTERSTITIAL_ID_IOS,
    import.meta.env.VITE_ADMOB_INTERSTITIAL_ID_ANDROID,
    TEST_INTERSTITIAL
  );

const rewardedId = (): string =>
  unitId(
    import.meta.env.VITE_ADMOB_REWARDED_ID_IOS,
    import.meta.env.VITE_ADMOB_REWARDED_ID_ANDROID,
    TEST_REWARDED
  );

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

  const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
  const listeners: Array<Promise<{ remove: () => Promise<void> }>> = [];

  try {
    await initAds();
    await AdMob.prepareRewardVideoAd({
      adId: rewardedId(),
      // Carried through to the SSV callback, and the only thing tying an ad
      // view to an account.
      ssv: { customData: playerId },
    });

    // The plugin settles showRewardVideoAd when the reward is granted, which is
    // while the ad is still on screen - returning then would have the caller
    // pop an alert underneath a fullscreen ad the player cannot dismiss yet.
    // And it never settles at all when the ad is closed without a reward, which
    // would hang the caller on a spinner forever. So track the reward, and
    // return only once the ad itself has gone away.
    let earned = false;
    const ended = new Promise<void>((resolve) => {
      listeners.push(
        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve()),
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve())
      );
    });

    void AdMob.showRewardVideoAd().then((reward) => {
      earned = !!reward;
    });

    await ended;
    return earned;
  } catch (error) {
    console.warn('Rewarded video unavailable:', error);
    return false;
  } finally {
    for (const listener of listeners) listener.then((handle) => handle.remove()).catch(() => {});
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
