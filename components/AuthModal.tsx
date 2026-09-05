import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../hooks/useTranslations';
import { API_URL } from '../lib/api';
import LoadingSpinner from './LoadingSpinner';
import useAnimatedDismiss from '../hooks/useAnimatedDismiss';

interface AuthModalProps {
  onClose: () => void;
  /** Shown when the player reached this from an upgrade attempt. */
  reason?: string;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

/** Loads Google's script once per page, however many times the modal opens. */
const loadGoogleScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${GSI_SRC}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(script);
  });

const AuthModal: React.FC<AuthModalProps> = ({ onClose, reason }) => {
  const { isClosing, dismiss } = useAnimatedDismiss(onClose);
  const { requestEmailCode, signInWithCode, signInWithGoogle } = useAuth();
  const { t } = useTranslations();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  // Only offer Google if the server says it is configured. Rendering a button
  // that cannot work is worse than not offering it at all.
  useEffect(() => {
    let cancelled = false;
    if (!GOOGLE_CLIENT_ID) return;

    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/methods`);
        const methods = await response.json();
        if (cancelled || !methods.google) return;

        await loadGoogleScript();
        if (cancelled) return;

        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response: { credential: string }) => {
            setError('');
            setIsLoading(true);
            try {
              // On success the page reloads, so there is no success state.
              await signInWithGoogle(response.credential);
            } catch (err: any) {
              setError(err.message || t('google_failed'));
              setIsLoading(false);
            }
          },
        });
        if (googleButtonRef.current) {
          google.accounts.id.renderButton(googleButtonRef.current, {
            theme: 'filled_black',
            size: 'large',
            width: 320,
            text: 'continue_with',
            shape: 'pill',
          });
        }
        setGoogleReady(true);
      } catch {
        // Leave the email path as the way in.
      }
    })();

    return () => { cancelled = true; };
  }, [signInWithGoogle, t]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError(t('email_invalid'));
      return;
    }
    setIsLoading(true);
    try {
      await requestEmailCode(email.trim());
      setStep('code');
    } catch (err: any) {
      setError(err.message || t('auth_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await signInWithCode(email.trim(), code.trim());
    } catch (err: any) {
      setError(err.message || t('auth_failed'));
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full bg-slate-700 border border-slate-600 rounded-xl py-3 px-4 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500';
  const submitClass =
    'w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold uppercase tracking-wider py-3 rounded-xl flex items-center justify-center transition-colors';

  return (
    <div className="modal-backdrop fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" data-closing={isClosing}>
      {/* Panel scrolls inside itself: a centred flex child taller than the
          viewport has its top clipped off-screen, putting the close button
          out of reach. */}
      <div className="modal-panel bg-slate-800 rounded-2xl max-w-md w-full relative max-h-[calc(100dvh-2rem)] flex flex-col">
        <button
          onClick={() => dismiss()}
          className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-200"
          aria-label={t('close')}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="overflow-y-auto p-6">
        {step === 'email' ? (
          <>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">{t('sign_in_title')}</h2>
            <p className="text-slate-400 text-sm mb-6">{reason || t('sign_in_blurb')}</p>

            {googleReady && (
              <>
                <div ref={googleButtonRef} className="flex justify-center mb-4" />
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-px flex-1 bg-slate-700" />
                  <span className="text-xs uppercase tracking-widest text-slate-500">{t('or')}</span>
                  <span className="h-px flex-1 bg-slate-700" />
                </div>
              </>
            )}
            {/* Mounted even when hidden, so Google has a node to render into. */}
            {!googleReady && <div ref={googleButtonRef} className="hidden" />}

            <form onSubmit={submitEmail} className="space-y-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('email')}
                autoComplete="email"
                className={inputClass}
                aria-label={t('email')}
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={isLoading} className={submitClass}>
                {isLoading ? <LoadingSpinner /> : t('send_code')}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">{t('check_email_title')}</h2>
            <p className="text-slate-400 text-sm mb-6">
              {t('check_email_desc')} <span className="text-slate-200 font-semibold">{email}</span>
            </p>

            <form onSubmit={submitCode} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('code_placeholder')}
                inputMode="numeric"
                autoComplete="one-time-code"
                className={`${inputClass} text-center text-2xl tracking-[0.4em] font-bold tabular-nums`}
                aria-label={t('code_placeholder')}
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={isLoading || code.length !== 6} className={submitClass}>
                {isLoading ? <LoadingSpinner /> : t('verify_code')}
              </button>
            </form>

            <div className="flex justify-between mt-4 text-sm">
              <button
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="text-slate-400 hover:text-cyan-400"
              >
                {t('use_another_email')}
              </button>
              <button
                onClick={async () => {
                  setError('');
                  try {
                    await requestEmailCode(email.trim());
                  } catch (err: any) {
                    setError(err.message || t('auth_failed'));
                  }
                }}
                className="text-slate-400 hover:text-cyan-400"
              >
                {t('resend_code')}
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
