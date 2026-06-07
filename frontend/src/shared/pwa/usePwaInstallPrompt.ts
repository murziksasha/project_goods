import { useCallback, useEffect, useState } from 'react';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const getStandaloneDisplay = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasStandaloneDisplay =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const hasIosStandaloneDisplay =
    'standalone' in window.navigator &&
    (window.navigator as NavigatorWithStandalone).standalone === true;

  return hasStandaloneDisplay || hasIosStandaloneDisplay;
};

const getStandaloneMediaQuery = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia('(display-mode: standalone)');
};

export const usePwaInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(getStandaloneDisplay);
  const canPromptInstall = Boolean(installPrompt) && !isStandalone;

  useEffect(() => {
    const standaloneMedia = getStandaloneMediaQuery();
    const handleDisplayModeChange = () => {
      setIsStandalone(getStandaloneDisplay());
    };
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    standaloneMedia?.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      standaloneMedia?.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!installPrompt || isStandalone) {
      return;
    }

    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    await promptEvent.userChoice;
  }, [installPrompt, isStandalone]);

  const dismissInstallPrompt = useCallback(() => {
    setInstallPrompt(null);
  }, []);

  return {
    canInstall: canPromptInstall,
    canPromptInstall,
    dismissInstallPrompt,
    installApp,
    isStandalone,
  };
};
