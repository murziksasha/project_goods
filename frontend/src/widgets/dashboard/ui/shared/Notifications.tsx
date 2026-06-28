import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createRuntimeId } from '../../../../shared/lib/runtime-id';

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
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pausedToastId, setPausedToastId] = useState<string | null>(null);
  const lastErrorRef = useRef('');
  const lastSuccessRef = useRef('');
  const pauseStartedAtRef = useRef<number | null>(null);
  const timersRef = useRef<Map<string, number>>(new Map());

  const clearToastTimer = useCallback((toastId: string) => {
    const timeoutId = timersRef.current.get(toastId);
    if (typeof timeoutId !== 'undefined') {
      window.clearTimeout(timeoutId);
      timersRef.current.delete(toastId);
    }
  }, []);

  const removeToast = useCallback((toastId: string) => {
    clearToastTimer(toastId);
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, [clearToastTimer]);

  const scheduleToastRemoval = useCallback((toastId: string, delayMs: number) => {
    clearToastTimer(toastId);
    const timeoutId = window.setTimeout(() => {
      removeToast(toastId);
    }, Math.max(0, delayMs));
    timersRef.current.set(toastId, timeoutId);
  }, [clearToastTimer, removeToast]);

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = '';
      return;
    }

    if (error === lastErrorRef.current) {
      return;
    }

    const toastId = createRuntimeId();
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
  }, [error, scheduleToastRemoval]);

  useEffect(() => {
    if (!successMessage) {
      lastSuccessRef.current = '';
      return;
    }

    if (successMessage === lastSuccessRef.current) {
      return;
    }

    const toastId = createRuntimeId();
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
  }, [scheduleToastRemoval, successMessage]);

  useEffect(() => {
    if (!pausedToastId) {
      return;
    }

    pauseStartedAtRef.current = Date.now();
    clearToastTimer(pausedToastId);

    return () => {
      pauseStartedAtRef.current = null;
    };
  }, [clearToastTimer, pausedToastId]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  const handleToastMouseEnter = (toastId: string) => {
    setPausedToastId(toastId);
  };

  const handleToastMouseLeave = (toastId: string) => {
    const now = new Date().getTime();
    const pausedStartedAt = pauseStartedAtRef.current ?? now;
    const pausedDuration = now - pausedStartedAt;

    setToasts((current) =>
      current.map((toast) => {
        if (toast.id !== toastId) {
          return toast;
        }

        const nextExpiresAt = toast.expiresAt + pausedDuration;
        const remainingMs = nextExpiresAt - now;
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
        {t('common.notifications.offlineViewOnly')}
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
            aria-label={t('common.notifications.closeNotification')}
            onClick={() => removeToast(toast.id)}
          >
            ×
          </button>
        </p>
      ))}
    </section>
  );
};
