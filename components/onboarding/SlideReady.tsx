import React from 'react';
import { useTranslations } from '../../hooks/useTranslations';

const COPY = {
  en: {
    says: 'Last thing. While you work out what they are, they are working out what you are.',
    you: 'You',
    them: 'Unknown',
    clock: '01:00',
    title: 'Your first stranger is',
    titleAccent: 'one tap away.',
    tail: 'No name, no photo, no second try. Just what they type — and what you make of it.',
  },
  tr: {
    says: 'Son bir şey. Sen onun ne olduğunu çözmeye çalışırken, o da senin ne olduğunu çözüyor.',
    you: 'Sen',
    them: 'Bilinmiyor',
    clock: '01:00',
    title: 'İlk yabancın',
    titleAccent: 'bir dokunuş uzakta.',
    tail: 'İsim yok, fotoğraf yok, ikinci deneme yok. Sadece yazdıkları — ve senin ne anladığın.',
  },
} as const;

/** The host, same face that opened the flow, here to see you off. */
const Host: React.FC = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className="w-14 h-14 sm:w-[68px] sm:h-[68px] shrink-0">
    <path d="M32 6v6" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
    <circle cx="32" cy="5" r="3" fill="#22d3ee" />
    <rect x="5" y="13" width="54" height="42" rx="14" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
    <circle cx="23" cy="31" r="4.5" fill="#22d3ee" />
    <circle cx="41" cy="31" r="4.5" fill="#22d3ee" />
    <path d="M24 41c2.5 3.5 13.5 3.5 16 0" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.55" />
  </svg>
);

/** You are a known person. They are a question mark - that is the whole game. */
const Party: React.FC<{ unknown?: boolean }> = ({ unknown }) => (
  <div className="relative w-16 h-16 sm:w-[72px] sm:h-[72px]">
    {unknown && (
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl border-2 border-cyan-400/40 animate-ping motion-reduce:hidden"
      />
    )}
    <div
      className={
        'relative w-full h-full rounded-2xl border-2 flex items-center justify-center ' +
        (unknown
          ? 'border-dashed border-slate-500 bg-slate-800/60 text-slate-300'
          : 'border-cyan-400/70 bg-cyan-400/10 text-cyan-300')
      }
    >
      {unknown ? (
        <span className="text-2xl sm:text-3xl font-black leading-none pb-0.5">?</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          className="w-8 h-8 sm:w-9 sm:h-9"
        >
          <circle cx="12" cy="8.5" r="3.6" />
          <path d="M5 19.5a7 7 0 0 1 14 0" />
        </svg>
      )}
    </div>
  </div>
);

const Label: React.FC<{ children: React.ReactNode; dim?: boolean }> = ({ children, dim }) => (
  <span
    className={
      'text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] ' +
      (dim ? 'text-slate-500' : 'text-cyan-400/80')
    }
  >
    {children}
  </span>
);

const SlideReady: React.FC = () => {
  const { language } = useTranslations();
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;

  return (
    <div className="stagger flex flex-col justify-center gap-7 sm:gap-9 min-h-full">
      {/* The host has one more thing to say before the door opens. */}
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

      {/* The starting line: you on one end, a question mark on the other, a clock waiting. */}
      <div className="rounded-3xl border border-slate-800 bg-slate-800/30 px-4 py-7 sm:px-10 sm:py-9">
        <div className="grid grid-cols-[auto_1fr_auto] items-center justify-items-center gap-x-3 sm:gap-x-6 gap-y-3">
          <Party />
          <div className="relative w-full flex items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-slate-700"
            />
            <span className="relative rounded-full border border-cyan-400/40 bg-slate-800 px-2.5 py-1 text-[10px] sm:text-xs font-black tracking-[0.15em] text-cyan-300">
              {c.clock}
            </span>
          </div>
          <Party unknown />

          <Label>{c.you}</Label>
          <span />
          <Label dim>{c.them}</Label>
        </div>
      </div>

      <h1 className="text-3xl sm:text-5xl font-black leading-[1.1] tracking-tight text-balance">
        {c.title} <span className="text-cyan-400">{c.titleAccent}</span>
      </h1>

      <p className="-mt-3 sm:-mt-4 text-sm sm:text-lg text-slate-400 leading-relaxed">{c.tail}</p>
    </div>
  );
};

export default SlideReady;
