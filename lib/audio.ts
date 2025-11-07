let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error("Web Audio API is not supported in this browser");
      return null;
    }
  }
  return audioCtx;
};

export const playSound = (type: 'sent' | 'received') => {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Create a brief ramp-down to avoid clicks if sound is played rapidly
  ctx.resume().then(() => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);

    if (type === 'sent') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.2);
    } else { // received
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
    }

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  });
};
