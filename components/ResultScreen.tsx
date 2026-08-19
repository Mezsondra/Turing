import React, { useState } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import { shareResult } from '../lib/shareCard';

interface ResultScreenProps {
  wasCorrect: boolean;
  actualPartner: 'HUMAN' | 'AI';
  onPlayAgain: () => void;
  score?: number;
  gamesPlayed?: number;
  gamesWon?: number;
  gamesLost?: number;
  currentStreak?: number;
  bestStreak?: number;
  timesFooled?: number;
  /** True when a human partner guessed this player was a bot. */
  fooledPartner?: boolean;
}

const ResultScreen: React.FC<ResultScreenProps> = ({
  wasCorrect,
  actualPartner,
  onPlayAgain,
  score = 0,
  gamesPlayed = 0,
  gamesWon = 0,
  gamesLost = 0,
  currentStreak = 0,
  bestStreak = 0,
  timesFooled = 0,
  fooledPartner = false,
}) => {
  const { t } = useTranslations();
  const [isSharing, setIsSharing] = useState(false);

  const getResultMessage = () => {
    if (wasCorrect) {
      return actualPartner === 'AI' ? t('correct_guess_ai') : t('correct_guess_human');
    }
    return actualPartner === 'AI' ? t('fooled_guess_ai') : t('fooled_guess_human');
  };

  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const pointsChange = wasCorrect ? '+10' : '-5';

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareResult({
        wasCorrect,
        actualPartner,
        score,
        currentStreak,
        fooledPartner,
        title: wasCorrect ? t('correct_guess_title') : t('fooled_guess_title'),
        subtitle: getResultMessage(),
        streakLabel: t('streak_badge'),
        scoreLabel: t('total_score'),
      });
    } catch (error) {
      console.error('Share failed:', error);
      alert(t('share_failed'));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4 text-center">
      <div className="max-w-md w-full py-8">
        {wasCorrect ? (
          <h2 className="text-5xl font-bold text-green-400 mb-4">{t('correct_guess_title')}</h2>
        ) : (
          <h2 className="text-5xl font-bold text-red-400 mb-4">{t('fooled_guess_title')}</h2>
        )}
        <p className="text-xl text-slate-300 mb-6">{getResultMessage()}</p>

        {/* Reverse role: the player was the one being judged, and won. */}
        {fooledPartner && (
          <div className="bg-cyan-500/10 border border-cyan-500/40 rounded-lg p-4 mb-6">
            <p className="text-cyan-300 font-bold text-lg">🎭 {t('fooled_partner_title')}</p>
            <p className="text-cyan-200/80 text-sm mt-1">{t('fooled_partner_desc')}</p>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className={`text-3xl font-bold ${wasCorrect ? 'text-green-400' : 'text-red-400'}`}>
              {pointsChange}
            </span>
            {currentStreak > 1 && (
              <span className="text-2xl font-bold text-orange-400">
                🔥 {currentStreak} {t('on_fire')}
              </span>
            )}
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

          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
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

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-700 rounded p-2">
              <p className="text-slate-400 text-xs mb-1">{t('current_streak')}</p>
              <p className="text-lg font-bold text-orange-400">{currentStreak}</p>
            </div>
            <div className="bg-slate-700 rounded p-2">
              <p className="text-slate-400 text-xs mb-1">{t('best_streak')}</p>
              <p className="text-lg font-bold text-orange-300">{bestStreak}</p>
            </div>
            <div className="bg-slate-700 rounded p-2">
              <p className="text-slate-400 text-xs mb-1">{t('times_fooled')}</p>
              <p className="text-lg font-bold text-cyan-400">{timesFooled}</p>
            </div>
          </div>
        </div>

        <button
          onClick={onPlayAgain}
          className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full text-xl transition-transform transform hover:scale-105 w-full"
        >
          {t('play_again')}
        </button>

        <button
          onClick={handleShare}
          disabled={isSharing}
          className="mt-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 font-semibold py-3 px-8 rounded-full w-full transition-colors"
        >
          {t('share_result')}
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
