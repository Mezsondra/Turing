import React from 'react';
import { useTranslations } from '../../hooks/useTranslations';

/**
 * Copy only. `rules` stays exactly three entries - one per prohibition - and
 * `icon` picks the glyph below, so the words can be rewritten without touching
 * the drawing. Every rule has a short second line; that is where the reason
 * lives, and it is what keeps the list from reading like terms of service.
 */
const COPY = {
  en: {
    says: 'Half the time the stranger is a real person - and they read every word you type.',
    rules: [
      {
        icon: 'language',
        label: 'No profanity or slurs',
        detail: 'The filter catches most of them before they send. What it misses, your partner reports.',
      },
      {
        icon: 'violence',
        label: 'No threats or violence',
        detail: 'Wishing harm on your partner does not land as a joke on the other end.',
      },
      {
        icon: 'harassment',
        label: 'No harassment',
        detail: 'Nothing sexual. If someone stops answering, that is their answer.',
      },
    ],
    enforce: 'Tap Report, pick a reason, and the whole conversation comes to us with it.',
    title: 'A person reads every report.',
    body: 'Break these and the transcript is filed against your account. Whoever reported you never gets matched with you again.',
  },
  tr: {
    says: 'Yarı yarıya karşındaki gerçek bir insan - ve yazdığın her kelimeyi okuyor.',
    rules: [
      {
        icon: 'language',
        label: 'Küfür ve nefret söylemi yok',
        detail: 'Filtre çoğunu daha gönderilmeden yakalar. Kaçanları karşındaki bildirir.',
      },
      {
        icon: 'violence',
        label: 'Tehdit ve şiddet yok',
        detail: 'Karşındakine zarar dilemek, öbür uçta şaka gibi durmuyor.',
      },
      {
        icon: 'harassment',
        label: 'Taciz yok',
        detail: 'Cinsel içerik yok. Biri cevap vermeyi bıraktıysa, cevabını almışsın demektir.',
      },
    ],
    enforce: 'Bildir’e dokun, bir sebep seç - konuşmanın tamamı da bize onunla gelir.',
    title: 'Her bildirimi bir insan okuyor.',
    body: 'Bunları çiğnersen konuşmanın tamamı hesabına işlenir. Seni bildiren kişi bir daha karşına çıkmaz.',
  },
} as const;

/** The host, matching slides 1 and 2 so the same face sets the house rules. */
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

/**
 * One drawn glyph per prohibition, all in the same line weight so the three
 * read as one set. Emoji would arrive in three different art styles.
 */
const ICONS: Record<'language' | 'violence' | 'harassment', React.ReactNode> = {
  // A speech bubble with the swearing scribbled out.
  language: (
    <>
      <rect x="3.25" y="4.25" width="17.5" height="12.5" rx="3.5" />
      <path d="M8 16.75v3.6l3.9-3.6" />
      <path d="M7.5 11.4l1.9-2.2 1.9 2.2 1.9-2.2 1.9 2.2" />
    </>
  ),
  // A strike: the shape a threat makes.
  violence: <path d="M13.2 2.5 5.5 13.2h5.1L10.4 21.5 18.5 10.4h-5.1z" />,
  // Someone turning away, with the block mark that follows.
  harassment: (
    <>
      <circle cx="9.6" cy="6.9" r="3.4" />
      <path d="M3.4 20.6c0-3.4 2.8-6.2 6.2-6.2 1.1 0 2.2.3 3.1.9" />
      <circle cx="17.6" cy="17.6" r="3.9" />
      <path d="M14.8 14.8l5.6 5.6" />
    </>
  ),
};

/** The tool that makes the rules real - drawn at the same tile scale as them. */
const FlagIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-5 h-5 sm:w-[22px] sm:h-[22px]"
  >
    <path d="M5 21.5V3.2" />
    <path d="M5 4.6h11.9l-1.9 3.9 1.9 3.9H5z" />
  </svg>
);

const SlideConduct: React.FC = () => {
  const { language } = useTranslations();
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;

  const tile =
    'shrink-0 grid place-items-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl ring-1 ring-inset';

  return (
    <div className="stagger flex flex-col gap-4 sm:gap-5">
      {/*
        The framing sentence is the page title, so it is set at title size - but
        the host still says it, because a voice is what carries slides 1, 2 and 5.
      */}
      <div className="flex items-start gap-3 sm:gap-4">
        <Host />
        <div className="relative mt-1.5 sm:mt-2 rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 sm:px-6 sm:py-5">
          <span
            aria-hidden="true"
            className="absolute -left-[7px] top-6 w-3 h-3 rotate-45 bg-slate-800 border-l border-b border-slate-700"
          />
          <h1 className="text-[22px] sm:text-[35px] font-black leading-[1.14] tracking-tight text-slate-100">
            {c.says}
          </h1>
        </div>
      </div>

      <div className="space-y-3">
        {/* One panel, not three cards - a thing you agree to, not a thing you pick from. */}
        <ul className="rounded-3xl border border-slate-800 bg-slate-800/25 divide-y divide-slate-800">
          {c.rules.map((r) => (
            <li key={r.label} className="flex items-start gap-3.5 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-3.5">
              <span className={`${tile} bg-rose-500/10 ring-rose-400/25 text-rose-300`}>
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 sm:w-[22px] sm:h-[22px]"
                >
                  {ICONS[r.icon]}
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] sm:text-lg font-bold text-slate-100 leading-snug">
                  {r.label}
                </span>
                <span className="block mt-0.5 text-[13px] sm:text-sm text-slate-400 leading-snug">
                  {r.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {/*
          Outside the panel on purpose: this is what you can do, not a fourth
          thing you must not do. Same tile, different tint - cyan, like the button.
        */}
        <div className="flex items-center gap-3.5 sm:gap-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 sm:px-5">
          <span className={`${tile} bg-cyan-400/10 ring-cyan-400/30 text-cyan-300`}>
            <FlagIcon />
          </span>
          <p className="text-[13px] sm:text-sm font-semibold text-slate-300 leading-snug">{c.enforce}</p>
        </div>
      </div>

      {/* The closing note sits at support size, right on top of the CTA it explains. */}
      <div>
        <p className="text-lg sm:text-xl font-bold text-slate-100 leading-snug mb-1.5">{c.title}</p>
        <p className="text-sm sm:text-base text-slate-400 leading-snug">{c.body}</p>
      </div>
    </div>
  );
};

export default SlideConduct;
