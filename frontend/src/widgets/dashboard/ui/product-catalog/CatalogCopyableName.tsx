import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { copyTextToClipboard } from '../../../../shared/lib/clipboard';

type CatalogCopyableNameProps = {
  name: string;
  onOpen: () => void;
  children?: ReactNode;
};

const CopyIcon = () => (
  <svg
    width="14"
    height="14"
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

export const CatalogCopyableName = ({
  name,
  onOpen,
  children,
}: CatalogCopyableNameProps) => {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );
  const trimmed = name.trim();
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

    const ok = await copyTextToClipboard(name);
    setCopyStatus(ok ? 'copied' : 'failed');
  };

  const copyLabel =
    copyStatus === 'copied'
      ? t('catalog.tables.copied')
      : copyStatus === 'failed'
        ? t('catalog.tables.copyFailed')
        : t('catalog.tables.copyName');

  return (
    <span className="catalog-name-cell">
      <button type="button" className="catalog-name-button" onClick={onOpen}>
        {name}
      </button>
      {canCopy ? (
        <button
          type="button"
          className={`catalog-name-copy-button${
            copyStatus === 'copied' ? ' catalog-name-copy-button-success' : ''
          }`}
          onClick={(event) => void handleCopy(event)}
          aria-label={copyLabel}
          title={copyLabel}
        >
          <CopyIcon />
        </button>
      ) : null}
      {children}
    </span>
  );
};
