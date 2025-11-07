import React, { useState, useEffect } from 'react';
import AdSenseAd from './AdSenseAd';
import { useTranslations } from '../hooks/useTranslations';

interface AdModalProps {
  onClose: () => void;
  showUpgradeButton?: boolean;
  onUpgrade?: () => void;
}

const AdModal: React.FC<AdModalProps> = ({ onClose, showUpgradeButton = true, onUpgrade }) => {
  const [countdown, setCountdown] = useState(10);
  const { t } = useTranslations();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full p-6 relative">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-slate-200 text-center mb-2">
            {t('ad_break_title') || 'Quick Ad Break'}
          </h2>
          <p className="text-slate-400 text-center text-sm">
            {t('ad_break_description') || 'Support us by watching this ad, or upgrade to Premium for ad-free experience'}
          </p>
        </div>

        <div className="my-6">
          <AdSenseAd
            adSlot="1234567890"
            adFormat="rectangle"
            fullWidthResponsive={false}
            style={{ display: 'block', minHeight: '250px' }}
          />
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
