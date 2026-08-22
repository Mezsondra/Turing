import React from 'react';
import { useTranslations } from '../hooks/useTranslations';

const KEY = 'turing_age_confirmed';

export const hasConfirmedAge = (): boolean => localStorage.getItem(KEY) === 'true';

/**
 * Age confirmation. This app pairs strangers in unmoderated live chat, which
 * carries a 17+ rating; stores expect a gate before that content is reachable.
 */
const AgeGate: React.FC<{ onConfirm: () => void }> = ({ onConfirm }) => {
  const { t } = useTranslations();

  const confirm = () => {
    localStorage.setItem(KEY, 'true');
    onConfirm();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-4">🔞</div>
        <h2 className="text-3xl font-bold text-slate-200 mb-3">{t('age_gate_title')}</h2>
        <p className="text-slate-400 mb-8">{t('age_gate_desc')}</p>

        <button
          onClick={confirm}
          className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full text-lg mb-3"
        >
          {t('age_gate_confirm')}
        </button>
        <a
          href="https://www.google.com"
          className="block w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-3 px-8 rounded-full"
        >
          {t('age_gate_leave')}
        </a>
      </div>
    </div>
  );
};

export default AgeGate;
