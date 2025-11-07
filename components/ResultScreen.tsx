import React from 'react';
import { useTranslations } from '../hooks/useTranslations';

interface ResultScreenProps {
  wasCorrect: boolean;
  actualPartner: 'HUMAN' | 'AI';
  onPlayAgain: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ wasCorrect, actualPartner, onPlayAgain }) => {
  const { t } = useTranslations();
  
  const getResultMessage = () => {
    if (wasCorrect) {
      return actualPartner === 'AI' ? t('correct_guess_ai') : t('correct_guess_human');
    } else {
      return actualPartner === 'AI' ? t('fooled_guess_ai') : t('fooled_guess_human');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-4 text-center">
      <div className="max-w-md">
        {wasCorrect ? (
          <h2 className="text-5xl font-bold text-green-400 mb-4">{t('correct_guess_title')}</h2>
        ) : (
          <h2 className="text-5xl font-bold text-red-400 mb-4">{t('fooled_guess_title')}</h2>
        )}
        <p className="text-xl text-slate-300 mb-8">{getResultMessage()}</p>
        <button
          onClick={onPlayAgain}
          className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full text-xl transition-transform transform hover:scale-105"
        >
          {t('play_again')}
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
