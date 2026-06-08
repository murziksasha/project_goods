import { usePwaInstallPrompt } from './usePwaInstallPrompt';

export const PwaInstallPrompt = () => {
  const { canPromptInstall, dismissInstallPrompt, installApp } = usePwaInstallPrompt();

  if (!canPromptInstall) {
    return null;
  }

  return (
    <div className="pwa-prompt pwa-install-prompt" role="status" aria-live="polite">
      <div>
        <strong>Install Goods Accounting</strong>
        <span>Open it from your desktop or home screen like a regular app.</span>
      </div>
      <div className="pwa-prompt-actions">
        <button type="button" className="secondary-button" onClick={dismissInstallPrompt}>
          Later
        </button>
        <button type="button" className="primary-button" onClick={() => void installApp()}>
          Install app
        </button>
      </div>
    </div>
  );
};
