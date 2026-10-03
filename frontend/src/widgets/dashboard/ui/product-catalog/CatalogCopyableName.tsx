import type React from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';

export interface CatalogCopyableNameProps {
  name: string;
  onOpen: () => void;
  children?: ReactNode;
};

export const CatalogCopyableName: React.FC<CatalogCopyableNameProps> = ({
  name,
  onOpen,
  children,
}) => {
  const { t } = useTranslation();

  return (
    <CopyableValue
      value={name}
      className="catalog-name-cell"
      copyLabel={t('catalog.tables.copyName')}
      copiedLabel={t('catalog.tables.copied')}
      failedLabel={t('catalog.tables.copyFailed')}
    >
      <button type="button" className="catalog-name-button" onClick={onOpen}>
        {name}
      </button>
      {children}
    </CopyableValue>
  );
};
