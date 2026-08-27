import React from 'react';
import { useTranslations } from '../../hooks/useTranslations';

const COPY = {
  en: {
    says: 'One stranger. Sixty seconds. Ask them anything you like.',
    title: 'The clock never stops.',
    body: 'Sixty seconds of live chat, then it cuts you off mid-sentence. Weird questions are the best ones - they are the hardest to fake.',
    score: 'Score 0',
    clock: '0:23',
    you1: "what's the last thing that made you laugh",
    them1: 'my cat fell off the windowsill',
    you2: 'prove it. what colour is she',
    placeholder: 'Type your message...',
    alt: 'The chat screen: a countdown reading 23 seconds with the round draining away, your messages in cyan on the right, the stranger replying in grey on the left, and a message box at the bottom.',
  },
  tr: {
    says: 'Tek bir yabancı. Altmış saniye. Ne istersen sor.',
    title: 'Saat hiç durmaz.',
    body: 'Altmış saniyelik canlı sohbet, sonra cümlenin ortasında kesilir. En iyi sorular tuhaf olanlardır - taklit etmesi en zor olanlar.',
    score: 'Skor 0',
    clock: '0:23',
    you1: 'seni en son ne güldürdü',
    them1: 'kedim pencere kenarından düştü',
    you2: 'kanıtla. ne renk',
    placeholder: 'Mesajını yaz...',
    alt: 'Sohbet ekranı: 23 saniye gösteren ve tükenen bir geri sayım, sağda senin mavi mesajların, solda yabancının gri cevabı, altta mesaj kutusu.',
  },
} as const;

/** The host, matching slide 1 so the same face teaches the whole flow. */
const Host: React.FC = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className="w-14 h-14 sm:w-[68px] sm:h-[68px] shrink-0">
    <path d="M32 6v6" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="5" r="3" fill="#22d3ee" />
    <rect x="5" y="13" width="54" height="42" rx="14" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
    <circle cx="23" cy="31" r="4.5" fill="#22d3ee" />
    <circle cx="41" cy="31" r="4.5" fill="#22d3ee" />
    <path d="M24 43h16" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
  </svg>
);

const Dot: React.FC<{ delay?: string }> = ({ delay }) => (
  <span
    className="w-2 h-2 rounded-full bg-slate-400 animate-pulse motion-reduce:animate-none"
    style={delay ? { animationDelay: delay } : undefined}
  />
);

const SlideHowToPlay: React.FC = () => {
  const { language } = useTranslations();
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;

  const mine = 'max-w-[86%] rounded-2xl rounded-br-md bg-cyan-600 px-4 py-2.5 text-sm sm:text-base text-white leading-snug';
  const theirs = 'max-w-[86%] rounded-2xl rounded-bl-md bg-slate-700 px-4 py-2.5 text-sm sm:text-base text-slate-200 leading-snug';

  return (
    <div className="stagger flex flex-col justify-center gap-6 sm:gap-8 min-h-full">
      {/* The host sets the rule before showing the screen it applies to. */}
      <div className="flex items-start gap-3 sm:gap-4">
        <Host />
        <div className="relative mt-2 rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 sm:px-5 sm:py-4">
          <span
            aria-hidden="true"
            className="absolute -left-[7px] top-5 w-3 h-3 rotate-45 bg-slate-800 border-l border-b border-slate-700"
          />
          <p className="text-base sm:text-lg font-semibold leading-snug text-slate-100">{c.says}</p>
        </div>
      </div>

      {/* A working-size replica of ChatScreen, so the next screen is already familiar. */}
      <div
        role="img"
        aria-label={c.alt}
        className="rounded-3xl overflow-hidden border border-slate-700 bg-slate-800 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between gap-3 bg-slate-900/80 px-4 py-2.5 border-b border-slate-700">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-500">{c.score}</span>
          <span className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse motion-reduce:animate-none" />
            <span className="font-mono text-xl sm:text-2xl font-bold text-cyan-400 tabular-nums leading-none">{c.clock}</span>
          </span>
        </div>

        {/* The round draining away - the whole reason this game is stressful. */}
        <div className="h-1.5 bg-slate-700">
          <div className="h-full w-[38%] bg-cyan-400" />
        </div>

        <div className="p-3 sm:p-4 space-y-2 sm:space-y-2.5">
          <div className="flex justify-end"><p className={mine}>{c.you1}</p></div>
          <div className="flex justify-start"><p className={theirs}>{c.them1}</p></div>
          <div className="flex justify-end"><p className={mine}>{c.you2}</p></div>
          <div className="flex justify-start">
            <span className="flex items-center gap-1.5 bg-slate-700 rounded-2xl rounded-bl-md px-4 py-3.5">
              <Dot />
              <Dot delay="200ms" />
              <Dot delay="400ms" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 px-3 py-2.5 border-t border-slate-700">
          <span className="flex-1 rounded-full bg-slate-700 border border-slate-600 px-4 py-2 text-sm text-slate-400 truncate">
            {c.placeholder}
          </span>
          <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-cyan-500 text-white">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-3xl sm:text-5xl font-black leading-[1.1] tracking-tight mb-3">{c.title}</h1>
        <p className="text-sm sm:text-lg text-slate-400 leading-relaxed">{c.body}</p>
      </div>
    </div>
  );
};

export default SlideHowToPlay;
