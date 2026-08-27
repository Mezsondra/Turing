import React, { useState } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import { shareResult } from '../lib/shareCard';
import ExitToMenu from './ExitToMenu';
import PrimaryButton from './ui/PrimaryButton';

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
  onExit: () => void;
}

const COPY = {
  en: { points: 'points', allStats: 'All stats' },
  tr: { points: 'puan', allStats: 'Tüm istatistikler' },
} as const;

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
  onExit,
}) => {
  const { t, language } = useTranslations();
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;
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

  // Three headline numbers stay on the surface; the rest of the career record
  // lives one tap down so a player who just finished a round is not handed a
  // spreadsheet. Nothing is lost — the disclosure holds every remaining stat.
  const headline = [
    { label: t('total_score'), value: score, tone: 'text-cyan-400' },
    { label: t('win_rate'), value: `${winRate}%`, tone: 'text-purple-400' },
    { label: t('current_streak'), value: currentStreak, tone: 'text-orange-400' },
  ];
  const record = [
    { label: t('games_played'), value: gamesPlayed, tone: 'text-slate-100' },
    { label: t('games_won'), value: gamesWon, tone: 'text-green-400' },
    { label: t('games_lost'), value: gamesLost, tone: 'text-red-400' },
    { label: t('best_streak'), value: bestStreak, tone: 'text-orange-300' },
    { label: t('times_fooled'), value: timesFooled, tone: 'text-cyan-300' },
  ];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-900">
      {/* Sharing is the optional flourish, so it takes the corner. */}
      <header className="flex shrink-0 items-center justify-end px-4 pt-4 sm:px-6 sm:pt-5">
        <button
          type="button"
          onClick={handleShare}
          disabled={isSharing}
          className="inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm font-bold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors motion-reduce:transition-none"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 15v3.75A1.75 1.75 0 0 0 6.25 20.5h11.5A1.75 1.75 0 0 0 19.5 18.75V15" />
          </svg>
          {t('share_result')}
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="m-auto w-full max-w-md px-5 py-6 text-center sm:py-10">
          <h2
            className={`text-4xl font-black tracking-tight sm:text-5xl ${
              wasCorrect ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {wasCorrect ? t('correct_guess_title') : t('fooled_guess_title')}
          </h2>

          {/* What this round moved, in one line. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span
              className={`rounded-full px-3.5 py-1.5 text-base font-black tabular-nums ${
                wasCorrect ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
              }`}
            >
              {pointsChange} {c.points}
            </span>
            {currentStreak > 1 && (
              <span className="rounded-full bg-orange-400/10 px-3.5 py-1.5 text-base font-black text-orange-400">
                🔥 {currentStreak} {t('on_fire')}
              </span>
            )}
          </div>

          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-slate-400 sm:text-lg">
            {getResultMessage()}
          </p>

          {/* Reverse role: the player was the one being judged, and won. */}
          {fooledPartner && (
            <div className="mt-5 rounded-2xl bg-cyan-500/10 p-4 text-left ring-1 ring-cyan-500/40">
              <p className="text-base font-bold text-cyan-300">🎭 {t('fooled_partner_title')}</p>
              <p className="mt-1 text-sm text-cyan-200/80">{t('fooled_partner_desc')}</p>
            </div>
          )}

          <dl className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {headline.map((s) => (
              <div key={s.label} className="rounded-2xl bg-slate-800 px-2 py-3.5 ring-1 ring-slate-700/70">
                <dd className={`text-2xl font-black tabular-nums sm:text-3xl ${s.tone}`}>{s.value}</dd>
                <dt className="mt-1 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {s.label}
                </dt>
              </div>
            ))}
          </dl>

          <details className="group mt-3 rounded-2xl bg-slate-800/50 text-left ring-1 ring-slate-700/70 open:bg-slate-800/80">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-xs font-bold uppercase tracking-[0.08em] text-slate-400 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
              {c.allStats}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={2.5}
                stroke="currentColor"
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </summary>
            <dl className="divide-y divide-slate-700/60 border-t border-slate-700/60 px-4">
              {record.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-sm text-slate-400">{s.label}</dt>
                  <dd className={`text-base font-bold tabular-nums ${s.tone}`}>{s.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </main>

      {/* The two real destinations, side by side in weight order, always on
          screen. Leaving is a choice the player is offered, not one they have
          to hunt for in a corner. */}
      <footer className="shrink-0 border-t border-slate-800 bg-slate-900 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
          <PrimaryButton full onClick={onPlayAgain}>
            {t('play_again')}
          </PrimaryButton>
          <ExitToMenu
            onExit={onExit}
            className="w-full justify-center gap-2 rounded-2xl! px-6 py-4 tracking-[0.035em] uppercase text-slate-200! shadow-[inset_0_0_0_2px_#334155,0_4px_0_0_#1e293b] hover:bg-slate-800! hover:shadow-[inset_0_0_0_2px_#475569,0_4px_0_0_#334155] active:translate-y-[4px] active:shadow-[inset_0_0_0_2px_#475569] [&>span]:inline"
          />
        </div>
      </footer>
    </div>
  );
};

export default ResultScreen;
