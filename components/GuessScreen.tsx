import React from 'react';
import { useTranslations } from '../hooks/useTranslations';

interface GuessScreenProps {
  onGuess: (guess: 'HUMAN' | 'AI') => void;
}

const GuessScreen: React.FC<GuessScreenProps> = ({ onGuess }) => {
  const { t } = useTranslations();
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-4 text-center">
      <div className="max-w-md">
        <h2 className="text-4xl md:text-5xl font-bold text-slate-200 mb-2">{t('times_up')}</h2>
        <p className="text-xl md:text-2xl text-cyan-400 mb-10">{t('guess_prompt')}</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => onGuess('HUMAN')}
            className="w-full sm:w-48 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-lg text-2xl transition-transform transform hover:scale-105"
          >
            <span role="img" aria-label="human" className="mr-2">👤</span>
            {t('human')}
          </button>
          <button
            onClick={() => onGuess('AI')}
            className="w-full sm:w-48 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-6 rounded-lg text-2xl transition-transform transform hover:scale-105"
          >
            <span role="img" aria-label="ai" className="mr-2">🤖</span>
            {t('ai')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuessScreen;
