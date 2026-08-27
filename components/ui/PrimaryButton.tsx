import React from 'react';

type Variant = 'primary' | 'ghost';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
}

// The pressable "shelf" button: a solid face sitting on a same-hue lip that is a
// shade darker, plus a hairline highlight along the top edge so the face reads as
// a physical slab. Pressing translates the face down by exactly the lip depth and
// removes the lip, so the button lands on the shelf and the click is felt.
// Type: the label grows on small screens rather than shrinking, because that is
// where the button goes full-width — 18px mobile / 16px from sm up. Tracking is
// kept just wide enough to read as a deliberate uppercase CTA, not a banner.
// (Class strings must stay literal — Tailwind scans this file as text.)
const base =
  'relative inline-flex items-center justify-center gap-2 select-none whitespace-nowrap ' +
  'rounded-2xl font-extrabold uppercase tracking-[0.035em] text-[1.125rem] sm:text-base leading-none ' +
  'min-h-[3.5rem] px-7 sm:px-8 py-4 ' +
  'transition-[background-color,box-shadow,translate,color] duration-100 ease-out motion-reduce:transition-none ' +
  // Focus: a real outline that traces the radius and sits clear of the fill, so it
  // stays obvious on both the cyan face and the dark ghost.
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-cyan-300 ' +
  'disabled:cursor-not-allowed disabled:opacity-100';

const variants: Record<Variant, string> = {
  primary: [
    'bg-cyan-400 text-slate-950',
    // face highlight + lip
    'shadow-[inset_0_2px_0_0_rgba(255,255,255,0.35),0_5px_0_0_#0891b2]',
    'hover:bg-cyan-300 hover:shadow-[inset_0_2px_0_0_rgba(255,255,255,0.42),0_5px_0_0_#06b6d4,0_10px_26px_-10px_rgba(34,211,238,0.75)]',
    // press: drop the full lip depth, lip disappears
    'active:translate-y-[5px] active:duration-75',
    'active:shadow-[inset_0_2px_0_0_rgba(255,255,255,0.28)]',
    'active:bg-cyan-400',
    // dead but still occupying its footprint: same box, flat fill, no shelf, no travel
    'disabled:bg-slate-800 disabled:text-slate-500',
    'disabled:shadow-[inset_0_0_0_2px_#1e293b]',
    'disabled:translate-y-0',
    'disabled:hover:bg-slate-800 disabled:hover:shadow-[inset_0_0_0_2px_#1e293b]',
  ].join(' '),
  ghost: [
    'bg-transparent text-slate-300',
    'shadow-[inset_0_0_0_2px_#334155,0_4px_0_0_#1e293b]',
    'hover:text-slate-100 hover:bg-slate-800/50 hover:shadow-[inset_0_0_0_2px_#475569,0_4px_0_0_#334155]',
    'active:translate-y-[4px] active:duration-75 active:shadow-[inset_0_0_0_2px_#475569]',
    'disabled:text-slate-600 disabled:shadow-[inset_0_0_0_2px_#1e293b] disabled:translate-y-0',
    'disabled:hover:bg-transparent disabled:hover:text-slate-600 disabled:hover:shadow-[inset_0_0_0_2px_#1e293b]',
  ].join(' '),
};

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  variant = 'primary',
  full = false,
  className = '',
  ...rest
}) => (
  <button
    {...rest}
    className={`${base} ${variants[variant]} ${full ? 'w-full' : 'min-w-[10rem]'} ${className}`}
  />
);

export default PrimaryButton;
