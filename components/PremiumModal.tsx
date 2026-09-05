import React, { useState } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import LoadingSpinner from './LoadingSpinner';
import useAnimatedDismiss from '../hooks/useAnimatedDismiss';
import { isNative, showRewarded } from '../lib/ads';
import { canPurchaseNatively, purchase, restore } from '../lib/purchases';
import { socketService } from '../services/socketService';

export type PremiumPlan = 'monthly' | 'yearly' | 'lifetime';

interface PremiumModalProps {
  onClose: () => void;
  onUpgrade: (plan: PremiumPlan) => Promise<void>;
  /** Server-side identity, needed to tag a rewarded ad. Absent before the
      first stats event, which is when the rewarded option stays hidden. */
  playerId?: string;
}

const Check = () => (
  <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </div>
);

const PremiumModal: React.FC<PremiumModalProps> = ({ onClose, onUpgrade, playerId }) => {
  const { isClosing, dismiss } = useAnimatedDismiss(onClose);
  const [isLoading, setIsLoading] = useState(false);
  const [watching, setWatching] = useState(false);
  const [plan, setPlan] = useState<PremiumPlan>('yearly');
  const { t } = useTranslations();

  const watchForRounds = async () => {
    if (!playerId) return;
    setWatching(true);
    const rewarded = await showRewarded(playerId);
    setWatching(false);

    if (!rewarded) {
      alert(t('no_video_available'));
      return;
    }

    // The rounds are credited by Google calling our server, not by this
    // client, so ask for a fresh balance rather than assuming one.
    socketService.refreshStats();
    alert(t('rounds_added'));
    onClose();
  };

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // Apple and Google both require their own billing for digital goods, so
      // the Stripe checkout that serves the web would get the app rejected.
      if (canPurchaseNatively() && playerId) {
        const bought = await purchase(playerId, plan);
        setIsLoading(false);
        if (!bought) return; // the player backed out; not an error

        // Entitlement arrives by webhook, not from this client, so ask rather
        // than assume - and say "may take a moment" instead of lying about it.
        socketService.refreshStats();
        alert(t('purchase_processing'));
        onClose();
        return;
      }

      await onUpgrade(plan);
    } catch (error: any) {
      console.error('Upgrade error:', error);
      alert(error?.message || t('auth_failed'));
      setIsLoading(false);
    }
  };

  // Apple requires a visible restore path, and it is the only way a lifetime
  // unlock survives a reinstall or a new device.
  const handleRestore = async () => {
    if (!playerId) return;
    setIsLoading(true);
    try {
      const found = await restore(playerId);
      socketService.refreshStats();
      alert(found ? t('purchase_restored') : t('nothing_to_restore'));
      if (found) onClose();
    } catch (error: any) {
      alert(error?.message || t('auth_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Benefits we can actually deliver. "Priority matching" was removed on
  // purpose: there is no queue to prioritise, and selling it invites refunds.
  const benefits = [
    [t('no_ads'), t('no_ads_desc')],
    [t('unlimited_rounds'), t('unlimited_rounds_desc')],
    [t('full_history'), t('full_history_desc')],
    [t('support_development'), t('support_development_desc')],
  ];

  const plans: Array<{ id: PremiumPlan; label: string; price: string; note: string; badge?: string }> = [
    { id: 'monthly', label: t('monthly'), price: '$2.99', note: t('per_month') },
    { id: 'yearly', label: t('yearly'), price: '$12.99', note: t('per_year'), badge: t('best_value') },
    { id: 'lifetime', label: t('lifetime'), price: '$50', note: t('one_time') },
  ];

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && dismiss()}
      className="modal-backdrop fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      data-closing={isClosing}
    >
      {/* The panel scrolls inside itself rather than the backdrop scrolling:
          a centred flex child taller than the viewport has its top clipped
          off-screen, which put the close button out of reach. */}
      <div className="modal-panel bg-slate-800 rounded-lg max-w-md w-full relative max-h-[calc(100dvh-2rem)] flex flex-col">
        <button
          onClick={() => dismiss()}
          className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-200"
          aria-label={t('close')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="overflow-y-auto p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full mb-4">
            <span className="text-3xl">⭐</span>
          </div>
          <h2 className="text-3xl font-bold text-slate-200 mb-2">{t('upgrade_to_premium')}</h2>
          <p className="text-slate-400">{t('premium_subtitle')}</p>
        </div>

        <div className="space-y-3 mb-6">
          {benefits.map(([title, description]) => (
            <div key={title} className="flex items-start space-x-3">
              <Check />
              <div>
                <p className="text-slate-200 font-semibold">{title}</p>
                <p className="text-slate-400 text-sm">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 mb-6">
          {plans.map((option) => (
            <button
              key={option.id}
              onClick={() => setPlan(option.id)}
              aria-pressed={plan === option.id}
              className={`w-full flex items-center justify-between rounded-lg p-4 border-2 transition-colors ${
                plan === option.id
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-600 bg-slate-700 hover:border-slate-500'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-slate-200 font-semibold">{option.label}</span>
                {option.badge && (
                  <span className="text-xs bg-cyan-500 text-white px-2 py-0.5 rounded-full">{option.badge}</span>
                )}
              </span>
              <span className="text-right">
                <span className="text-xl font-bold text-cyan-400">{option.price}</span>
                <span className="text-slate-400 text-xs block">{option.note}</span>
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={handleUpgrade}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-full transition-all shadow-lg disabled:opacity-50 flex items-center justify-center"
        >
          {isLoading ? <LoadingSpinner /> : t('start_premium')}
        </button>

        {/* Native only: there is no rewarded format on the web build. Placed
            under the paid CTA rather than beside it - it is the fallback for
            someone who will not pay today, not a competing offer. */}
        {isNative() && playerId && (
          <button
            onClick={watchForRounds}
            disabled={watching}
            className="w-full mt-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-3 px-6 rounded-full transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {watching ? <LoadingSpinner /> : <>▶ {t('watch_ad_for_rounds')}</>}
          </button>
        )}

        {canPurchaseNatively() && playerId && (
          <button
            onClick={handleRestore}
            disabled={isLoading}
            className="w-full mt-3 text-slate-400 hover:text-slate-200 text-sm py-2 disabled:opacity-50"
          >
            {t('restore_purchases')}
          </button>
        )}

        <p className="text-slate-500 text-center text-xs mt-4">
          {plan === 'lifetime' ? t('one_time') : t('cancel_anytime')} · {t('secure_payment')}
        </p>
        </div>
      </div>
    </div>
  );
};

export default PremiumModal;
