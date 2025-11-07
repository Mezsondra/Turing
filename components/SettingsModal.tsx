import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { useTranslations } from '../hooks/useTranslations';
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
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
