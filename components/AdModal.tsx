import React, { useState, useEffect } from 'react';
import AdSenseAd from './AdSenseAd';
import { useTranslations } from '../hooks/useTranslations';
import { isNative, showInterstitial } from '../lib/ads';

interface AdModalProps {
  onClose: () => void;
  showUpgradeButton?: boolean;
  onUpgrade?: () => void;
}

// No ad network wired up yet (AdSense refuses thin-content sites, and this
// game's web build has almost no text). Until one exists, this slot sells
// Premium instead of rendering an empty frame.
const hasAdNetwork = Boolean(import.meta.env.VITE_ADSENSE_CLIENT_ID);

const AdModal: React.FC<AdModalProps> = ({ onClose, showUpgradeButton = true, onUpgrade }) => {
  // Nothing to wait for when there is no ad to watch.
  const [countdown, setCountdown] = useState(hasAdNetwork ? 10 : 0);
  const { t } = useTranslations();

  // On native the ad IS the interface: AdMob draws its own full-screen
  // activity, so this modal has nothing to render behind it. Trigger it and
  // step out of the way. showInterstitial resolves on failure too, so a
  // missing fill closes the modal rather than trapping the player.
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    showInterstitial().finally(() => {
      if (!cancelled) onClose();
    });
    return () => { cancelled = true; };
  }, [onClose]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // After every hook, never between them: an early return above the countdown
  // effect would change the hook count between renders.
  if (isNative()) return null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full p-6 relative">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-slate-200 text-center mb-2">
            {hasAdNetwork ? t('ad_break_title') : t('support_us_title')}
          </h2>
          <p className="text-slate-400 text-center text-sm">
            {hasAdNetwork ? t('ad_break_description') : t('support_us_desc')}
          </p>
        </div>

        <div className="my-6">
          {hasAdNetwork ? (
            <AdSenseAd
              adSlot="1234567890"
              adFormat="rectangle"
              fullWidthResponsive={false}
              style={{ display: 'block', minHeight: '250px' }}
            />
          ) : (
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">⭐</div>
              <p className="text-slate-200 font-semibold mb-1">{t('upgrade_to_premium')}</p>
              <p className="text-slate-400 text-sm">{t('no_ads_desc')}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          {showUpgradeButton && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105 shadow-lg"
            >
              ⭐ {t('upgrade_to_premium') || 'Upgrade to Premium'}
            </button>
          )}

          <button
            onClick={onClose}
            disabled={countdown > 0}
            className={`${
              countdown > 0
                ? 'bg-slate-600 cursor-not-allowed'
                : 'bg-slate-700 hover:bg-slate-600'
            } text-white font-bold py-3 px-6 rounded-full transition-all`}
          >
            {countdown > 0
              ? `${t('continue_in') || 'Continue in'} ${countdown}s`
              : t('continue') || 'Continue'}
          </button>
        </div>

        {!showUpgradeButton && (
          <div className="mt-4 text-center">
            <p className="text-slate-500 text-xs">
              {t('ads_help_support') || 'Ads help us keep this service free for everyone'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdModal;
