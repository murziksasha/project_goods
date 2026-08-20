import { useEffect, useState } from 'react';

const isDocumentVisible = () =>
  typeof document === 'undefined' || document.visibilityState === 'visible';

export const useVisibleRefetchInterval = (ms: number, enabled = true) => {
  const [isVisible, setIsVisible] = useState(isDocumentVisible);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const sync = () => setIsVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return enabled && isVisible ? ms : false;
};
