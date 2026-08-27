import React, { useEffect, useRef, useState } from 'react';
import PrimaryButton from '../ui/PrimaryButton';

interface OnboardingShellProps {
  step: number;          // 0-based
  total: number;
  direction: 'forward' | 'back';
  cta: string;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  children: React.ReactNode;
}

/** Must outlast the longest slide animation in index.css (380ms). */
const TRANSITION_MS = 420;

/** Header and footer share one column so the chrome reads as a deliberate frame,
 *  wider than the 2xl reading column it wraps rather than accidentally off by a
 *  few rem. */
const CHROME = 'w-full max-w-5xl mx-auto px-6 sm:px-8';

/**
 * Frame every onboarding slide shares: progress at the top, one idea in the
 * middle, one commitment at the bottom. Slides own their content and nothing
 * else, so they can be judged - and rebuilt - on their own.
 *
 * The shell also owns the motion between slides. It keeps the outgoing slide
 * mounted for one animation so both slides travel together in the same
 * direction; without that the old screen would vanish on a hard cut and only
 * the new one would animate, which reads as a stutter rather than a flow.
 */
const OnboardingShell: React.FC<OnboardingShellProps> = ({
  step, total, direction, cta, onBack, onNext, onSkip, skipLabel, children,
}) => {
  const [leaving, setLeaving] = useState<{ step: number; node: React.ReactNode } | null>(null);
  const [shownStep, setShownStep] = useState(step);
  const lastNode = useRef<React.ReactNode>(children);

  // Derive the outgoing layer during render so it paints in the same frame the
  // new step does - a useEffect here would show one frame with the new slide
  // already alone on screen.
  if (shownStep !== step) {
    setLeaving({ step: shownStep, node: lastNode.current });
    setShownStep(step);
  }

  useEffect(() => { lastNode.current = children; });

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  // Keyed by step so React keeps the outgoing slide's DOM: it changes state
  // from "current" to "leaving" instead of remounting and replaying its stagger.
  const layers = leaving ? [leaving, { step, node: children }] : [{ step, node: children }];
  const pct = Math.min(100, Math.max(0, ((step + 1) / total) * 100));

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-900 text-slate-100">
      <header className={`${CHROME} flex items-center gap-4 sm:gap-5 pt-6 sm:pt-10 pb-3 sm:pb-4`}>
        <button
          onClick={onBack}
          disabled={step === 0}
          aria-label="Back"
          className="shrink-0 -ml-2 p-2 rounded-full text-slate-500 hover:text-slate-100 hover:bg-slate-800 transition-colors
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300
                     disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div
          className="relative flex-1 h-3.5 sm:h-4 rounded-full bg-slate-700/60 overflow-hidden"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            data-progress-fill
            className="relative h-full min-w-4 rounded-full bg-cyan-400
                       transition-[width] duration-[600ms] ease-[cubic-bezier(0.34,1.26,0.64,1)]"
            style={{ width: `${pct}%` }}
          >
            {/* The lit sliver along the top edge that keeps the fill from reading flat. */}
            <span className="absolute left-[10%] right-[10%] top-[3px] h-[3px] rounded-full bg-white/25" />
          </div>
        </div>

        {onSkip && (
          <button
            onClick={onSkip}
            className="shrink-0 text-[0.6875rem] sm:text-xs font-bold uppercase tracking-[0.14em] text-slate-500
                       hover:text-slate-200 transition-colors rounded
                       focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          >
            {skipLabel}
          </button>
        )}
      </header>

      {/* One clipping stage; each slide is its own scroller so a long slide still
          scrolls while the frame around it never moves. */}
      <main className="relative flex-1 overflow-hidden">
        {layers.map((layer) => {
          const isLeaving = layer.step !== step;
          return (
            <div
              key={layer.step}
              data-slide-dir={direction}
              data-slide-state={isLeaving ? 'leaving' : 'current'}
              aria-hidden={isLeaving || undefined}
              className={`absolute inset-0 flex overflow-y-auto overflow-x-hidden ${isLeaving ? 'pointer-events-none' : ''}`}
            >
              {/* m-auto (not justify-center) centres in the leftover height without
                  clipping the top when a slide is taller than the stage. The heavier
                  bottom padding biases short slides above centre, so tall viewports
                  compose instead of stranding the content in the top third. */}
              <div className="m-auto w-full max-w-2xl min-h-full px-6 pt-6 pb-6 sm:pt-10 sm:pb-10">
                {layer.node}
              </div>
            </div>
          );
        })}
        {/* Fades the last line into the footer, so an overflowing slide reads as
            "there is more below" instead of as a clipped one. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900 to-transparent"
        />
      </main>

      <footer className="shrink-0 border-t border-slate-800 bg-slate-900">
        <div className={`${CHROME} flex justify-center sm:justify-end pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:py-8`}>
          <PrimaryButton onClick={onNext} className="w-full sm:w-auto sm:min-w-[13rem]">
            {cta}
          </PrimaryButton>
        </div>
      </footer>
    </div>
  );
};

export default OnboardingShell;
