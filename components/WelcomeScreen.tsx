import React, { useState } from 'react';
import SettingsModal from './SettingsModal';
import PrimaryButton from './ui/PrimaryButton';
import { useTranslations } from '../hooks/useTranslations';

interface WelcomeScreenProps {
  onStartGame: () => void;
  score?: number;
  currentStreak?: number;
  gamesPlayed?: number;
  isPremium?: boolean;
  roundsLeft?: number | null;
  onOpenAccount?: () => void;
  onReplayIntro?: () => void;
  isAuthenticated?: boolean;
}

const COPY = {
  en: {
    play: 'Play',
    again: 'Play again',
    tagline: 'Sixty seconds to tell a person from a machine.',
    how: 'How to play',
    welcomeBack: 'Welcome back',
    stepsTitle: 'A round, start to finish',
    steps: ['Sixty seconds on the clock', 'Chat with your opponent', 'Call it: human or AI?'],
    unlimited: 'Unlimited play',
    goUnlimited: 'Go unlimited',
    streakGoal: 'Streak goal',
    more: 'more in a row',
  },
  tr: {
    play: 'Oyna',
    again: 'Tekrar oyna',
    tagline: 'Bir insanı makineden ayırmak için altmış saniye.',
    how: 'Nasıl oynanır',
    welcomeBack: 'Tekrar hoş geldin',
    stepsTitle: 'Baştan sona bir tur',
    steps: ['Sürede altmış saniye', 'Rakibinle sohbet et', 'Karar ver: insan mı, yapay zekâ mı?'],
    unlimited: 'Sınırsız oyun',
    goUnlimited: 'Sınırsıza geç',
    streakGoal: 'Seri hedefi',
    more: 'doğru tahmin kaldı',
  },
} as const;

const STEP_ICONS = ['⏱️', '💬', '🎯'];
const MILESTONES = [3, 5, 10, 25, 50, 100];

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartGame,
  score = 0,
  currentStreak = 0,
  gamesPlayed = 0,
  isPremium = false,
  roundsLeft = null,
  onOpenAccount,
  onReplayIntro,
  isAuthenticated = false,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { t, language } = useTranslations();
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;

  const returning = gamesPlayed > 0;
  const unlimited = roundsLeft === null;
  const showRounds = roundsLeft !== null || isPremium;
  const outOfRounds = roundsLeft === 0;
  const milestone = MILESTONES.find((m) => m > currentStreak) ?? Math.ceil((currentStreak + 1) / 50) * 50;
  const streakPct = Math.min(100, Math.round((currentStreak / milestone) * 100));
  const tile = 'rounded-2xl bg-slate-800/60 border-2 border-slate-700/70 border-b-4 py-4 px-2';

  return (
    <>
      <div className="flex flex-col h-[100dvh] bg-slate-900 text-slate-100">
        <header className="shrink-0 border-b border-slate-800/80">
          <div className="flex items-center justify-between gap-3 px-5 py-3 max-w-lg w-full mx-auto">
            {onOpenAccount ? (
              <button
                onClick={onOpenAccount}
                className={`rounded-full border-2 px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                  isPremium
                    ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/15'
                    : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-cyan-400'
                }`}
              >
                {isPremium ? `⭐ ${t('premium_member')}` : t('account')}
              </button>
            ) : <span />}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="grid place-items-center w-11 h-11 shrink-0 rounded-full border-2 border-slate-800 text-slate-500 hover:text-cyan-400 hover:border-slate-700 transition-colors"
              aria-label={t('settings_title')}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 0 1 0 1.905c.008.379.137.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.6 6.6 0 0 1-.22.128c-.333.183-.582.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.397-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.759 6.759 0 0 1 0-1.905c-.008-.379-.137-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto flex flex-col px-6 py-8 text-center">
          <div className="stagger max-w-lg w-full m-auto">
            <div className="relative mb-9">
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-10 w-72 h-52 rounded-full bg-cyan-500/10 blur-3xl"
              />
              <div className="relative flex items-center justify-center gap-4 mb-7">
                <span className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-slate-800 border-2 border-slate-700 border-b-4 flex items-center justify-center text-4xl sm:text-5xl">🧑</span>
                <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-slate-800 text-[11px] font-black tracking-widest text-slate-400">VS</span>
                <span className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-slate-800 border-2 border-slate-700 border-b-4 flex items-center justify-center text-4xl sm:text-5xl">🤖</span>
              </div>

              {returning && (
                <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-400 mb-2">{c.welcomeBack}</p>
              )}
              <h1 className="relative text-4xl sm:text-5xl font-black tracking-tight text-slate-100 text-balance mb-3">
                {t('welcome_title')}
              </h1>
              <p className="relative text-slate-400 text-base sm:text-lg text-balance">{c.tagline}</p>
            </div>

            {returning ? (
              <div className={`grid gap-3 mb-6 ${showRounds ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className={tile}>
                  <p className="text-3xl font-black text-cyan-400 tabular-nums leading-none mb-1.5">{score}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('total_score')}</p>
                </div>
                <div className={tile}>
                  <p className="text-3xl font-black text-orange-400 tabular-nums leading-none mb-1.5">
                    <span className="text-2xl align-middle">🔥</span> {currentStreak}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('current_streak')}</p>
                </div>
                {showRounds && (
                  <div className={tile}>
                    <p
                      className={`text-3xl font-black tabular-nums leading-none mb-1.5 ${
                        unlimited ? 'text-cyan-300' : roundsLeft! <= 1 ? 'text-amber-400' : 'text-slate-100'
                      }`}
                    >
                      {unlimited ? '∞' : roundsLeft}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      {unlimited ? c.unlimited : t('rounds_left')}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6 text-left">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3 px-1">{c.stepsTitle}</p>
                <ul className="rounded-2xl border-2 border-slate-800 bg-slate-800/30 divide-y-2 divide-slate-800 overflow-hidden">
                  {c.steps.map((step, i) => (
                    <li key={step} className="flex items-center gap-3 px-4 py-3.5">
                      <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-slate-800 text-lg">{STEP_ICONS[i]}</span>
                      <span className="text-sm sm:text-base font-semibold text-slate-300">{step}</span>
                      <span className="ml-auto text-xs font-black tabular-nums text-slate-600">{i + 1}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {returning && !outOfRounds && (
              <div className="rounded-2xl border-2 border-slate-800 bg-slate-800/30 p-4 mb-6 text-left">
                <div className="flex items-baseline justify-between gap-3 mb-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">🔥 {c.streakGoal}</p>
                  <p className="text-[11px] font-black tabular-nums text-slate-500">{currentStreak}/{milestone}</p>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden ring-1 ring-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{ width: `${streakPct}%` }}
                  />
                </div>
                <p className="mt-2.5 text-xs font-semibold text-slate-500">
                  {milestone - currentStreak} {c.more}
                </p>
              </div>
            )}

            {outOfRounds && (
              <div className="rounded-2xl border-2 border-cyan-400/30 bg-cyan-400/[0.07] p-4 text-left flex items-start gap-3">
                <span className="grid place-items-center w-10 h-10 shrink-0 rounded-xl bg-cyan-400/15 text-lg">⭐</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-200">
                    {isAuthenticated ? t('no_rounds_left') : t('no_rounds_left_guest')}
                  </p>
                  {onOpenAccount && (
                    <button
                      onClick={onOpenAccount}
                      className="mt-2 text-xs font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {isAuthenticated ? c.goUnlimited : t('create_account')} →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="shrink-0 border-t border-slate-800/80">
          <div className="px-6 pt-4 pb-6 max-w-lg w-full mx-auto">
            <PrimaryButton onClick={onStartGame} full>
              {returning ? c.again : c.play}
            </PrimaryButton>
            {onReplayIntro && (
              <button
                onClick={onReplayIntro}
                className="mt-3 w-full text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors py-2"
              >
                {c.how}
              </button>
            )}
          </div>
        </footer>
      </div>
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </>
  );
};

export default WelcomeScreen;
