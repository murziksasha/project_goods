import { useEffect, useRef, useState } from 'react';

type NotificationsProps = {
  error: string;
  successMessage: string;
  isOffline: boolean;
};

type ToastItem = {
  id: string;
  tone: 'error' | 'success';
  message: string;
  expiresAt: number;
};

const maxToastsInStack = 5;
const successToastTtlMs = 3000;
const errorToastTtlMs = 6000;

export const Notifications = ({
  error,
  successMessage,
  isOffline,
}: NotificationsProps) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pausedToastId, setPausedToastId] = useState<string | null>(null);
  const lastErrorRef = useRef('');
  const lastSuccessRef = useRef('');
  const pauseStartedAtRef = useRef<number | null>(null);
  const timersRef = useRef<Map<string, number>>(new Map());

  const clearToastTimer = (toastId: string) => {
    const timeoutId = timersRef.current.get(toastId);
    if (typeof timeoutId !== 'undefined') {
      window.clearTimeout(timeoutId);
      timersRef.current.delete(toastId);
    }
  };

  const removeToast = (toastId: string) => {
    clearToastTimer(toastId);
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  const scheduleToastRemoval = (toastId: string, delayMs: number) => {
    clearToastTimer(toastId);
    const timeoutId = window.setTimeout(() => {
      removeToast(toastId);
    }, Math.max(0, delayMs));
    timersRef.current.set(toastId, timeoutId);
  };

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = '';
      return;
    }

    if (error === lastErrorRef.current) {
      return;
    }

    const toastId = crypto.randomUUID();
    const nextToast: ToastItem = {
      id: toastId,
      tone: 'error',
      message: error,
      expiresAt: Date.now() + errorToastTtlMs,
    };
    lastErrorRef.current = error;
    setToasts((current) =>
      [nextToast, ...current].slice(0, maxToastsInStack),
    );
    scheduleToastRemoval(toastId, errorToastTtlMs);
  }, [error]);

  useEffect(() => {
    if (!successMessage) {
      lastSuccessRef.current = '';
      return;
    }

    if (successMessage === lastSuccessRef.current) {
      return;
    }

    const toastId = crypto.randomUUID();
    const nextToast: ToastItem = {
      id: toastId,
      tone: 'success',
      message: successMessage,
      expiresAt: Date.now() + successToastTtlMs,
    };
    lastSuccessRef.current = successMessage;
    setToasts((current) =>
      [nextToast, ...current].slice(0, maxToastsInStack),
    );
    scheduleToastRemoval(toastId, successToastTtlMs);
  }, [successMessage]);

  useEffect(() => {
    if (!pausedToastId) {
      return;
    }

    pauseStartedAtRef.current = Date.now();
    clearToastTimer(pausedToastId);

    return () => {
      pauseStartedAtRef.current = null;
    };
  }, [pausedToastId]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timersRef.current.clear();
    };
  }, []);

  const handleToastMouseEnter = (toastId: string) => {
    setPausedToastId(toastId);
  };

  const handleToastMouseLeave = (toastId: string) => {
    const pausedStartedAt = pauseStartedAtRef.current ?? Date.now();
    const pausedDuration = Date.now() - pausedStartedAt;

    setToasts((current) =>
      current.map((toast) => {
        if (toast.id !== toastId) {
          return toast;
        }

        const nextExpiresAt = toast.expiresAt + pausedDuration;
        const remainingMs = nextExpiresAt - Date.now();
        scheduleToastRemoval(toast.id, remainingMs);

        return {
          ...toast,
          expiresAt: nextExpiresAt,
        };
      }),
    );

    setPausedToastId((current) => (current === toastId ? null : current));
    pauseStartedAtRef.current = null;
  };

  return (
    <section className="toast-stack" aria-live="polite" aria-atomic="true">
    {isOffline ? (
      <p className="toast toast-error toast-persistent" role="status">
        No internet connection. You can view cached data, but edits are disabled.
      </p>
    ) : null}
      {toasts.map((toast) => (
        <p
          key={toast.id}
          className={toast.tone === 'error' ? 'toast toast-error' : 'toast toast-success'}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          onMouseEnter={() => handleToastMouseEnter(toast.id)}
          onMouseLeave={() => handleToastMouseLeave(toast.id)}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Close notification"
            onClick={() => removeToast(toast.id)}
          >
            ×
          </button>
        </p>
      ))}
    </section>
  );
};
