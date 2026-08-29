import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { useTranslations } from '../hooks/useTranslations';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';
import ToggleSwitch from './ToggleSwitch';

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { 
    language, setLanguage, 
    isSoundEnabled, setIsSoundEnabled, 
    isVibrationEnabled, setIsVibrationEnabled 
  } = useSettings();
  const { t } = useTranslations();
  const { isAuthenticated, isPremium, user, logout, manageSubscription } = useAuth();

  // Apple requires account deletion to be reachable in-app, not by emailing support.
  const deleteAccount = async () => {
    if (!window.confirm(t('delete_account_confirm'))) return;

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/api/auth/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      alert(t('delete_account_done'));
      logout(); // reloads the page
    }
  };

  const openBilling = async () => {
    try {
      await manageSubscription();
    } catch (error: any) {
      alert(error?.message || t('auth_failed'));
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div 
        className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-700"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <div className="flex justify-between items-center mb-6">
          <h2 id="settings-title" className="text-2xl font-bold text-cyan-400">{t('settings_title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label={t('close')}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="language-select" className="block text-lg text-slate-300 mb-2">{t('language')}</label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'tr')}
              className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="en">English</option>
              <option value="tr">Türkçe</option>
            </select>
          </div>
          
          <ToggleSwitch 
            label={t('sound_effects')}
            checked={isSoundEnabled}
            onChange={setIsSoundEnabled}
          />
          
          <ToggleSwitch 
            label={t('vibration')}
            checked={isVibrationEnabled}
            onChange={setIsVibrationEnabled}
          />

          {isAuthenticated && (
            <div className="border-t border-slate-700 pt-4 space-y-3">
              <p className="text-slate-400 text-sm truncate">{user?.email}</p>
              {isPremium && (
                <button
                  onClick={openBilling}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 rounded-lg"
                >
                  {t('manage_subscription')}
                </button>
              )}
              <button
                onClick={logout}
                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 rounded-lg"
              >
                {t('sign_out')}
              </button>
              <button
                onClick={deleteAccount}
                className="w-full text-red-400 hover:text-red-300 text-sm py-1"
              >
                {t('delete_account')}
              </button>
            </div>
          )}

          <div className="pt-4 mt-2 border-t border-slate-700 flex justify-center gap-4 text-xs text-slate-400">
            <a href="/privacy.html" target="_blank" rel="noopener" className="hover:text-slate-200">
              {t('privacy_policy')}
            </a>
            <a href="/terms.html" target="_blank" rel="noopener" className="hover:text-slate-200">
              {t('terms_of_service')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
