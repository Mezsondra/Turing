import React, { useState } from 'react';
import OnboardingShell from './OnboardingShell';
import SlideChallenge from './SlideChallenge';
import SlideHowToPlay from './SlideHowToPlay';
import SlideVerdict from './SlideVerdict';
import SlideConduct from './SlideConduct';
import SlideReady from './SlideReady';
import { useTranslations } from '../../hooks/useTranslations';

const KEY = 'turing_onboarded';

export const hasOnboarded = (): boolean => localStorage.getItem(KEY) === 'true';

const CTA = {
  en: { next: 'Continue', agree: 'I agree', play: 'Play', skip: 'Skip' },
  tr: { next: 'Devam', agree: 'Kabul ediyorum', play: 'Oyna', skip: 'Atla' },
} as const;

const SLIDES = [SlideChallenge, SlideHowToPlay, SlideVerdict, SlideConduct, SlideReady];

const Onboarding: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { language } = useTranslations();
  const cta = CTA[language as keyof typeof CTA] ?? CTA.en;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  const finish = () => {
    localStorage.setItem(KEY, 'true');
    onDone();
  };

  const next = () => {
    if (step === SLIDES.length - 1) return finish();
    setDirection('forward');
    setStep((s) => s + 1);
  };

  const back = () => {
    if (step === 0) return;
    setDirection('back');
    setStep((s) => s - 1);
  };

  const Slide = SLIDES[step];
  const label = step === SLIDES.length - 1 ? cta.play : step === 3 ? cta.agree : cta.next;

  return (
    <OnboardingShell
      step={step}
      total={SLIDES.length}
      direction={direction}
      cta={label}
      onBack={back}
      onNext={next}
      onSkip={step < SLIDES.length - 1 ? finish : undefined}
      skipLabel={cta.skip}
    >
      <Slide />
    </OnboardingShell>
  );
};

export default Onboarding;
