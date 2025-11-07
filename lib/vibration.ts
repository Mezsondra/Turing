export const triggerVibration = (pattern: number | number[] = 100) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch(e) {
      console.warn("Vibration failed. This can happen if the document is not focused.", e);
    }
  }
};
