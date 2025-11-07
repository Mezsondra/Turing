import React from 'react';
import { useTranslations } from '../hooks/useTranslations';

interface ResultScreenProps {
  wasCorrect: boolean;
  actualPartner: 'HUMAN' | 'AI';
  onPlayAgain: () => void;
  score?: number;
  gamesPlayed?: number;
  gamesWon?: number;
  gamesLost?: number;
}

const ResultScreen: React.FC<ResultScreenProps> = ({
  wasCorrect,
  actualPartner,
  onPlayAgain,
  score = 0,
  gamesPlayed = 0,
  gamesWon = 0,
  gamesLost = 0
}) => {
  const { t } = useTranslations();

  const getResultMessage = () => {
    if (wasCorrect) {
      return actualPartner === 'AI' ? t('correct_guess_ai') : t('correct_guess_human');
    } else {
      return actualPartner === 'AI' ? t('fooled_guess_ai') : t('fooled_guess_human');
    }
  };

  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const pointsChange = wasCorrect ? '+10' : '-5';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 text-center">
      <div className="max-w-md w-full">
        {wasCorrect ? (
          <h2 className="text-5xl font-bold text-green-400 mb-4">{t('correct_guess_title')}</h2>
        ) : (
          <h2 className="text-5xl font-bold text-red-400 mb-4">{t('fooled_guess_title')}</h2>
        )}
        <p className="text-xl text-slate-300 mb-6">{getResultMessage()}</p>

        {/* Score Display */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-center mb-4">
            <span className={`text-3xl font-bold ${wasCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {pointsChange}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-slate-700 rounded-lg p-3">
              <p className="text-slate-400 text-sm mb-1">{t('total_score')}</p>
              <p className="text-2xl font-bold text-cyan-400">{score}</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-3">
              <p className="text-slate-400 text-sm mb-1">{t('win_rate')}</p>
              <p className="text-2xl font-bold text-purple-400">{winRate}%</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-700 rounded p-2">
              <p className="text-slate-400 text-xs mb-1">{t('games_played')}</p>
              <p className="text-lg font-bold text-white">{gamesPlayed}</p>
            </div>
            <div className="bg-slate-700 rounded p-2">
              <p className="text-slate-400 text-xs mb-1">{t('games_won')}</p>
              <p className="text-lg font-bold text-green-400">{gamesWon}</p>
            </div>
            <div className="bg-slate-700 rounded p-2">
              <p className="text-slate-400 text-xs mb-1">{t('games_lost')}</p>
              <p className="text-lg font-bold text-red-400">{gamesLost}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onPlayAgain}
          className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full text-xl transition-transform transform hover:scale-105 w-full"
        >
          {t('play_again')}
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
