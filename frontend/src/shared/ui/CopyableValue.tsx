import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { copyTextToClipboard } from '../lib/clipboard';

type CopyableValueProps = {
  value: string;
  children: ReactNode;
  className?: string;
  copyLabel?: string;
  copiedLabel?: string;
  failedLabel?: string;
};

const CopyIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const CopyableValue = ({
  value,
  children,
  className,
  copyLabel,
  copiedLabel,
  failedLabel,
}: CopyableValueProps) => {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  const trimmed = value.trim();
  const canCopy = Boolean(trimmed);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timeoutId = window.setTimeout(() => setCopyStatus('idle'), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canCopy) return;

    const ok = await copyTextToClipboard(trimmed);
    setCopyStatus(ok ? 'copied' : 'failed');
  };

  const label =
    copyStatus === 'copied'
      ? (copiedLabel ?? t('common.copied'))
      : copyStatus === 'failed'
        ? (failedLabel ?? t('common.copyFailed'))
        : (copyLabel ?? t('common.copy'));

  return (
    <span className={['copyable-value', className].filter(Boolean).join(' ')}>
      <span className="copyable-value-content">{children}</span>
      {canCopy ? (
        <button
          type="button"
          className={`copyable-value-copy catalog-name-copy-button${
            copyStatus === 'copied'
              ? ' copyable-value-copy-success catalog-name-copy-button-success'
              : ''
          }`}
          onClick={(event) => void handleCopy(event)}
          onMouseDown={(event) => event.stopPropagation()}
          aria-label={label}
          title={label}
        >
          <CopyIcon />
        </button>
      ) : null}
    </span>
  );
};
