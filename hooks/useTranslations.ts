import { useSettings } from '../context/SettingsContext';
import en from '../translations/en.json';
import tr from '../translations/tr.json';

const translations: Record<string, Partial<typeof en>> = { en, tr };

export const useTranslations = () => {
  const { language } = useSettings();

  type TranslationKey = keyof typeof en;

  // Admins can add languages that have no UI strings yet, so always fall back
  // to English rather than crashing on an unknown language code.
  const t = (key: TranslationKey): string =>
    translations[language]?.[key] || en[key] || key;

  return { t, language };
};
