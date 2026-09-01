import { useCallback, useEffect, useRef, useState } from 'react';

const EXIT_DURATION_MS = 150;

/** Keeps a transient surface mounted long enough for its exit transition to finish. */
const useAnimatedDismiss = (onDismiss: () => void) => {
  const [isClosing, setIsClosing] = useState(false);
  const closingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  const dismiss = useCallback((afterDismiss?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    timeoutRef.current = window.setTimeout(() => {
      (afterDismiss ?? onDismissRef.current)();
    }, EXIT_DURATION_MS);
  }, []);

  return { isClosing, dismiss };
};

export default useAnimatedDismiss;
