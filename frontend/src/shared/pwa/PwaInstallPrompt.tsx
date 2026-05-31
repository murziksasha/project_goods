import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const isStandaloneDisplay = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in window.navigator && window.navigator.standalone === true);

export const PwaInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() =>
    typeof window === 'undefined' ? false : isStandaloneDisplay(),
  );

  useEffect(() => {
    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsStandalone(isStandaloneDisplay());
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
    standaloneMedia.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      standaloneMedia.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }

    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    await promptEvent.userChoice;
  };

  if (!installPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="pwa-prompt pwa-install-prompt" role="status" aria-live="polite">
      <div>
        <strong>Install Goods Accounting</strong>
        <span>Open it from your desktop or home screen like a regular app.</span>
      </div>
      <div className="pwa-prompt-actions">
        <button type="button" className="secondary-button" onClick={() => setInstallPrompt(null)}>
          Later
        </button>
        <button type="button" className="primary-button" onClick={() => void handleInstall()}>
          Install app
        </button>
      </div>
    </div>
  );
};
