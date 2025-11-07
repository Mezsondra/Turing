import { useSettings } from '../context/SettingsContext';
import en from '../translations/en.js';
import tr from '../translations/tr.js';

const translations = { en, tr };

export const useTranslations = () => {
  const { language } = useSettings();

  type TranslationKey = keyof typeof en;

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key;
  };

  return { t, language };
};