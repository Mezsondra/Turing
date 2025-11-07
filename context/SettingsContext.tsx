import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Language } from '../types';

interface SettingsContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  isSoundEnabled: boolean;
  setIsSoundEnabled: (enabled: boolean) => void;
  isVibrationEnabled: boolean;
  setIsVibrationEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('turing_test_language');
    return (saved === 'en' || saved === 'tr') ? saved : 'en';
  });

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('turing_test_sound');
    return saved ? JSON.parse(saved) : true;
  });

  const [isVibrationEnabled, setIsVibrationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('turing_test_vibration');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('turing_test_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('turing_test_sound', JSON.stringify(isSoundEnabled));
  }, [isSoundEnabled]);

  useEffect(() => {
    localStorage.setItem('turing_test_vibration', JSON.stringify(isVibrationEnabled));
  }, [isVibrationEnabled]);

  const value = {
    language,
    setLanguage,
    isSoundEnabled,
    setIsSoundEnabled,
    isVibrationEnabled,
    setIsVibrationEnabled,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
