import React from 'react';
import { useTranslations } from '../../hooks/useTranslations';

const COPY = {
  en: {
    says: 'Same question. Two answers. Only one came from a person.',
    you: 'You',
    prompt: 'What made you laugh today?',
    a: 'my sister’s cat fell off the windowsill mid-stare. twice.',
    b: 'someone called the CEO “mom” on a video call and just kept talking.',
    title: 'Which one is the machine?',
    body: 'That is the Turing Test. Alan Turing asked it in 1950: if you cannot tell the difference, is there one?',
    body2: 'Seventy-five years later, you are the judge.',
  },
  tr: {
    says: 'Aynı soru. İki cevap. Sadece biri bir insandan geldi.',
    you: 'Sen',
    prompt: 'Bugün seni ne güldürdü?',
    a: 'kız kardeşimin kedisi pencere pervazından düştü. hem de iki kez.',
    b: 'biri görüntülü toplantıda CEO’ya “anne” dedi ve konuşmaya devam etti.',
    title: 'Hangisi makine?',
    body: 'İşte Turing Testi. Alan Turing 1950’de sordu: aradaki farkı anlayamıyorsan, gerçekten bir fark var mı?',
    body2: 'Yetmiş beş yıl sonra kararı sen veriyorsun.',
  },
} as const;

/** The host: a small terminal face. Hand-drawn so it can look at you. */
const Host: React.FC = () => (
  <span className="relative shrink-0 w-16 h-16 sm:w-20 sm:h-20">
    <span aria-hidden="true" className="absolute inset-1 rounded-full bg-cyan-400/15 blur-xl" />
    <svg viewBox="0 0 64 64" aria-hidden="true" className="relative w-full h-full">
      <path d="M32 6v6" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3" fill="#22d3ee" />
      <rect x="5" y="13" width="54" height="42" rx="14" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
      <circle cx="23" cy="31" r="4.5" fill="#22d3ee" />
      <circle cx="41" cy="31" r="4.5" fill="#22d3ee" />
      <path d="M24 43h16" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
    </svg>
  </span>
);

const Answer: React.FC<{ letter: string; text: string }> = ({ letter, text }) => (
  <div className="flex items-start gap-3">
    <span className="mt-0.5 shrink-0 w-8 h-8 rounded-full border-2 border-slate-600 text-slate-300 text-xs font-black flex items-center justify-center">
      {letter}
    </span>
    <p className="rounded-2xl rounded-tl-md bg-slate-800 border border-slate-700 px-4 py-3 text-sm sm:text-base text-slate-200 leading-snug">
      {text}
    </p>
  </div>
);

const SlideChallenge: React.FC = () => {
  const { language } = useTranslations();
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;

  return (
    <div className="stagger flex flex-col justify-center gap-7 sm:gap-9 min-h-full">
      {/* The host speaks first, the way a good tutorial does. */}
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

      {/* The picture is the game: one question, two answers, no tell. */}
      <div className="rounded-3xl border border-slate-800 bg-slate-800/25 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 pr-1">
            {c.you}
          </span>
          <p className="max-w-[88%] rounded-2xl rounded-br-md bg-cyan-400 shadow-[0_3px_0_0_#0e7490] px-4 py-3 text-sm sm:text-base font-semibold text-slate-900 leading-snug">
            {c.prompt}
          </p>
        </div>
        <Answer letter="A" text={c.a} />
        <Answer letter="B" text={c.b} />
      </div>

      <h1 className="text-3xl sm:text-5xl font-black leading-[1.1] tracking-tight">{c.title}</h1>

      <div className="-mt-3 sm:-mt-4">
        <p className="text-sm sm:text-lg text-slate-400 leading-relaxed">{c.body}</p>
        <p className="mt-2 text-sm sm:text-lg font-semibold text-slate-200 leading-relaxed">{c.body2}</p>
      </div>
    </div>
  );
};

export default SlideChallenge;
