import React, { useState } from 'react';
import SettingsModal from './SettingsModal';
import { useTranslations } from '../hooks/useTranslations';

interface WelcomeScreenProps {
  onStartGame: () => void;
  score?: number;
  currentStreak?: number;
  gamesPlayed?: number;
  isPremium?: boolean;
  roundsLeft?: number | null;
  onOpenAccount?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartGame,
  score = 0,
  currentStreak = 0,
  gamesPlayed = 0,
  isPremium = false,
  roundsLeft = null,
  onOpenAccount,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { t } = useTranslations();

  return (
    <>
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 p-4 text-center relative">
        {onOpenAccount && (
          <button
            onClick={onOpenAccount}
            className="absolute top-4 left-4 text-slate-400 hover:text-cyan-400 transition-colors text-sm font-semibold"
          >
            {isPremium ? `⭐ ${t('premium_member')}` : t('account')}
          </button>
        )}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="absolute top-4 right-4 text-slate-400 hover:text-cyan-400 transition-colors"
          aria-label="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 0 1 0 1.905c.008.379.137.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.6 6.6 0 0 1-.22.128c-.333.183-.582.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.759 6.759 0 0 1 0-1.905c-.008-.379-.137-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-bold text-cyan-400 mb-4">{t('welcome_title')}</h1>
          <p className="text-lg md:text-xl text-slate-300 mb-8">
            {t('welcome_description')}
          </p>
          {gamesPlayed > 0 && (
            <div className="flex items-center justify-center gap-6 mb-8">
              <div>
                <p className="text-slate-400 text-sm">{t('total_score')}</p>
                <p className="text-3xl font-bold text-cyan-400">{score}</p>
              </div>
              {currentStreak > 0 && (
                <div>
                  <p className="text-slate-400 text-sm">{t('current_streak')}</p>
                  <p className="text-3xl font-bold text-orange-400">🔥 {currentStreak}</p>
                </div>
              )}
            </div>
          )}

          {roundsLeft !== null && roundsLeft <= 3 && (
            <p className={`mb-4 text-sm ${roundsLeft === 0 ? 'text-red-400' : 'text-amber-400'}`}>
              {roundsLeft === 0 ? t('no_rounds_left') : `${roundsLeft} ${t('rounds_left_today')}`}
            </p>
          )}

          <button
            onClick={onStartGame}
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-8 rounded-full text-xl transition-transform transform hover:scale-105"
          >
            {t('start_chatting')}
          </button>
        </div>
      </div>
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </>
  );
};

export default WelcomeScreen;
