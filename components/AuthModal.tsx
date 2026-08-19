import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../hooks/useTranslations';
import LoadingSpinner from './LoadingSpinner';

interface AuthModalProps {
  onClose: () => void;
  /** Shown when the player reached this from an upgrade attempt. */
  reason?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, reason }) => {
  const { login, register } = useAuth();
  const { t } = useTranslations();
  const [isRegistering, setIsRegistering] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('password_too_short'));
      return;
    }

    setIsLoading(true);
    try {
      // On success the page reloads, so there is no success state to render.
      if (isRegistering) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.message || t('auth_failed'));
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full bg-slate-700 border border-slate-600 rounded-lg py-3 px-4 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500';

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
          aria-label={t('close')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-slate-200 mb-2">
          {isRegistering ? t('create_account') : t('sign_in')}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {reason || (isRegistering ? t('create_account_desc') : t('sign_in_desc'))}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('email')}
            autoComplete="email"
            className={inputClass}
            aria-label={t('email')}
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('password')}
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            className={inputClass}
            aria-label={t('password')}
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white font-bold py-3 rounded-full flex items-center justify-center"
          >
            {isLoading ? <LoadingSpinner /> : isRegistering ? t('create_account') : t('sign_in')}
          </button>
        </form>

        <button
          onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
          className="w-full text-slate-400 hover:text-cyan-400 text-sm mt-4"
        >
          {isRegistering ? t('have_account') : t('need_account')}
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
