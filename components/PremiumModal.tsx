import React, { useState } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import LoadingSpinner from './LoadingSpinner';

interface PremiumModalProps {
  onClose: () => void;
  onUpgrade: () => Promise<void>;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ onClose, onUpgrade }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslations();

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      await onUpgrade();
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to start upgrade process. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full mb-4">
            <span className="text-3xl">⭐</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-200 mb-2">
            {t('upgrade_to_premium') || 'Upgrade to Premium'}
          </h2>
          <p className="text-slate-400">
            {t('premium_subtitle') || 'Enjoy an ad-free experience'}
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-slate-200 font-semibold">{t('no_ads') || 'No Ads'}</p>
              <p className="text-slate-400 text-sm">{t('no_ads_desc') || 'Play unlimited games without interruptions'}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-slate-200 font-semibold">{t('priority_matching') || 'Priority Matching'}</p>
              <p className="text-slate-400 text-sm">{t('priority_matching_desc') || 'Get matched with other players faster'}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-slate-200 font-semibold">{t('support_development') || 'Support Development'}</p>
              <p className="text-slate-400 text-sm">{t('support_development_desc') || 'Help us improve and maintain the service'}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-700 rounded-lg p-4 mb-6">
          <div className="flex items-baseline justify-center">
            <span className="text-4xl font-bold text-cyan-400">$4.99</span>
            <span className="text-slate-400 ml-2">{t('per_month') || '/ month'}</span>
          </div>
          <p className="text-slate-500 text-center text-sm mt-1">
            {t('cancel_anytime') || 'Cancel anytime'}
          </p>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-full transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
        >
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            t('start_premium') || 'Start Premium'
          )}
        </button>

        <p className="text-slate-500 text-center text-xs mt-4">
          {t('secure_payment') || 'Secure payment powered by Stripe'}
        </p>
      </div>
    </div>
  );
};

export default PremiumModal;
