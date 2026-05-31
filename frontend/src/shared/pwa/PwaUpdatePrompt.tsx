import { useRegisterSW } from 'virtual:pwa-register/react';

export const PwaUpdatePrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Service worker registration failed:', error);
    },
  });

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="pwa-update-prompt" role="status" aria-live="polite">
      <div>
        <strong>New version available</strong>
        <span>Reload when you are ready to update the app.</span>
      </div>
      <div className="pwa-update-actions">
        <button type="button" className="secondary-button" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <button type="button" className="primary-button" onClick={() => void updateServiceWorker(true)}>
          Reload
        </button>
      </div>
    </div>
  );
};
