import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from '../hooks/useTranslations';

const COPY = {
  en: {
    label: 'Menu',
    aria: 'Back to menu',
    title: 'Leave the round?',
    body: 'You forfeit this round, and the person on the other side is left waiting for a reply.',
    stay: 'Keep playing',
    confirm: 'Leave anyway',
  },
  tr: {
    label: 'Menü',
    aria: 'Menüye dön',
    title: 'Turdan çıkılsın mı?',
    body: 'Bu turu kaybedersin ve karşı taraftaki kişi cevap bekler kalır.',
    stay: 'Oynamaya devam',
    confirm: 'Yine de çık',
  },
} as const;

/**
 * The way out. Mid-round it confirms first, because leaving forfeits and
 * strands a real partner; after the round it just goes.
 *
 * The trigger stays icon-only until `sm` so it never crowds the chat header,
 * where it shares a row with the score, the report flag and the countdown.
 */
const ExitToMenu: React.FC<{ onExit: () => void; confirm?: boolean; className?: string }> = ({
  onExit,
  confirm = false,
  className = '',
}) => {
  const { language } = useTranslations();
  const c = COPY[language as keyof typeof COPY] ?? COPY.en;
  const [asking, setAsking] = useState(false);
  const [shown, setShown] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);
  const leaveRef = useRef<HTMLButtonElement>(null);

  // Open on the safe answer, and animate in on the next frame.
  useEffect(() => {
    if (!asking) {
      setShown(false);
      return;
    }
    stayRef.current?.focus();
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [asking]);

  const dismiss = () => {
    setAsking(false);
    triggerRef.current?.focus();
  };

  // Escape out, and keep Tab between the two answers instead of wandering
  // into the live chat behind the dialog.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key !== 'Tab') return;
    const stops = [stayRef.current, leaveRef.current].filter(Boolean) as HTMLButtonElement[];
    if (stops.length < 2) return;
    const at = stops.indexOf(document.activeElement as HTMLButtonElement);
    e.preventDefault();
    stops[e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : (at === -1 || at === stops.length - 1 ? 0 : at + 1)].focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (confirm ? setAsking(true) : onExit())}
        aria-label={c.aria}
        aria-haspopup={confirm ? 'dialog' : undefined}
        aria-expanded={confirm ? asking : undefined}
        className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-colors motion-reduce:transition-none ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15m0 0 6.75 6.75M4.5 12l6.75-6.75" />
        </svg>
        <span className="hidden sm:inline">{c.label}</span>
      </button>

      {/* Portalled: the chat header's backdrop-blur makes it the containing
          block for fixed children, which would clip the dialog to the header. */}
      {asking && createPortal(
        <div
          onClick={(e) => e.target === e.currentTarget && dismiss()}
          onKeyDown={handleKeyDown}
          className={`fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 transition-opacity duration-150 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            aria-describedby="exit-body"
            className={`w-full max-w-sm rounded-3xl bg-slate-800 border border-slate-700 shadow-2xl p-6 text-center transition-transform duration-200 motion-reduce:transition-none ${shown ? 'translate-y-0' : 'translate-y-4'}`}
          >
            <h3 id="exit-title" className="text-2xl font-black text-slate-100 mb-2">{c.title}</h3>
            <p id="exit-body" className="text-slate-400 mb-6">{c.body}</p>
            <button
              ref={stayRef}
              type="button"
              onClick={dismiss}
              className="w-full rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold uppercase tracking-widest py-3.5 shadow-[0_5px_0_0_#0e7490] active:translate-y-[5px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 transition-[transform,box-shadow] motion-reduce:transition-none mb-3"
            >
              {c.stay}
            </button>
            <button
              ref={leaveRef}
              type="button"
              onClick={onExit}
              className="w-full rounded-2xl border-2 border-red-500/40 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 font-extrabold uppercase tracking-widest py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 transition-colors motion-reduce:transition-none"
            >
              {c.confirm}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default ExitToMenu;
