import React, { useState } from 'react';
import { useTranslations } from '../../hooks/useTranslations';

const COPY = {
  en: {
    kicker: 'Make the call',
    title: 'Then you decide.',
    body: 'The clock stops and you name them — human or AI. Get it right and the streak climbs. Get it wrong and you learn how you were played.',
    timesUp: "Time's up",
    prompt: 'Who were you talking to?',
    tryIt: 'Try it',
    human: 'Human',
    ai: 'AI',
    idle: 'Pick one. Nothing is on the line yet.',
    correctTitle: 'Called it. That was an AI.',
    correctNote: 'Two in a row',
    wrongTitle: 'It had you. That was an AI.',
    wrongNote: 'Streak back to zero',
    bonusKicker: 'The best way to win',
    bonusTitle: 'They thought you were the bot.',
    bonusBody: 'If your partner was human and they called you the AI, you pocket the bonus for being unreadable — even when your own guess misses.',
  },
  tr: {
    kicker: 'Kararını ver',
    title: 'Sonra sen karar veriyorsun.',
    body: 'Süre durur ve adını koyarsın — insan mı, yapay zekâ mı? Doğru bilirsen seri büyür. Yanılırsan nasıl kandırıldığını görürsün.',
    timesUp: 'Süre doldu',
    prompt: 'Kiminle konuşuyordun?',
    tryIt: 'Dene',
    human: 'İnsan',
    ai: 'Yapay zekâ',
    idle: 'Birini seç. Şimdilik kaybedecek bir şey yok.',
    correctTitle: 'Bildin. O bir yapay zekâydı.',
    correctNote: 'Üst üste iki',
    wrongTitle: 'Seni kandırdı. O bir yapay zekâydı.',
    wrongNote: 'Seri sıfırlandı',
    bonusKicker: 'Kazanmanın en iyi yolu',
    bonusTitle: 'Seni bot sandılar.',
    bonusBody: 'Eşin insansa ve seni yapay zekâ sandıysa, okunamadığın için bonusu cebe atarsın — kendi tahminin tutmasa bile.',
  },
} as const;

type Pick = 'HUMAN' | 'AI' | null;

/** The demo partner is always an AI, so "AI" is the winning call. */
const SlideVerdict: React.FC = () => {
  const { language } = useTranslations();
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;
  const [pick, setPick] = useState<Pick>(null);
  const correct = pick === 'AI';

  const cardTone = (side: Exclude<Pick, null>) => {
    if (pick === null) return 'border-slate-700 border-b-slate-950 bg-slate-800/60 text-slate-200 hover:bg-slate-800 hover:border-slate-600';
    if (pick !== side) return 'border-slate-800 border-b-slate-950 bg-slate-800/30 text-slate-600';
    return side === 'AI'
      ? 'border-green-400 border-b-green-600 bg-green-400/10 text-green-300'
      : 'border-red-400 border-b-red-600 bg-red-400/10 text-red-300';
  };

  return (
    <div className="stagger">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400 mb-2">{c.kicker}</p>
      <h1 className="text-[28px] sm:text-[42px] font-black leading-tight mb-3">{c.title}</h1>
      <p className="text-base sm:text-lg text-slate-400 leading-snug mb-4 sm:mb-6">{c.body}</p>

      {/* A working miniature of the guess screen: one tap, real stakes, no consequences. */}
      <div className="rounded-3xl bg-slate-800/40 border border-slate-700/70 p-4 sm:p-5 mb-3 sm:mb-4">
        <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{c.timesUp}</p>
            <p className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">{c.prompt}</p>
          </div>
          <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-cyan-300">
            {c.tryIt}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(['HUMAN', 'AI'] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => setPick(side)}
              aria-pressed={pick === side}
              className={`rounded-2xl border-2 border-b-4 py-4 sm:py-6 transition-colors duration-150 active:translate-y-px active:border-b-2 motion-reduce:transition-none motion-reduce:active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${cardTone(side)}`}
            >
              <span className="block text-2xl sm:text-3xl mb-1.5" aria-hidden="true">{side === 'AI' ? '🤖' : '👤'}</span>
              <span className="block text-sm font-black uppercase tracking-widest">{side === 'AI' ? c.ai : c.human}</span>
            </button>
          ))}
        </div>

        <div
          aria-live="polite"
          className={`mt-3 flex min-h-[58px] sm:min-h-[64px] items-center gap-4 rounded-2xl border px-4 py-3 transition-colors duration-300 motion-reduce:transition-none ${
            pick === null
              ? 'justify-center border-dashed border-slate-700 text-slate-500'
              : correct
                ? 'border-green-400/40 bg-green-400/10'
                : 'border-red-400/40 bg-red-400/10'
          }`}
        >
          {pick === null ? (
            <p className="text-sm font-semibold">{c.idle}</p>
          ) : (
            <>
              <span className={`text-3xl font-black tabular-nums ${correct ? 'text-green-400' : 'text-red-400'}`}>
                {correct ? '+10' : '−5'}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${correct ? 'text-green-300' : 'text-red-300'}`}>
                  {correct ? c.correctTitle : c.wrongTitle}
                </span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  {correct ? `🔥 ${c.correctNote}` : c.wrongNote}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* The rule nobody expects, given the room it deserves. */}
      <div className="flex items-start gap-4 rounded-3xl border border-cyan-500/40 bg-cyan-500/[0.07] p-3.5 sm:p-4">
        <span className="shrink-0 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xl font-black tabular-nums text-cyan-300">+5</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-400/80">🎭 {c.bonusKicker}</p>
          <p className="text-base sm:text-lg font-black text-slate-100 mt-0.5">{c.bonusTitle}</p>
          <p className="text-sm text-slate-400 leading-snug mt-1">{c.bonusBody}</p>
        </div>
      </div>
    </div>
  );
};

export default SlideVerdict;
