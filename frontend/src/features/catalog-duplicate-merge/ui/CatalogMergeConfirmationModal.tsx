import type React from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import { InlineError } from '../../../shared/ui/InlineError';

export interface CatalogMergeConfirmationModalProps {
  isOpen: boolean;
  isMerging?: boolean;
  targetName: string;
  sourceName: string;
  targetNote?: string;
  sourceNote?: string;
  targetDetails?: ReactNode;
  sourceDetails?: ReactNode;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const CatalogMergeConfirmationModal: React.FC<
  CatalogMergeConfirmationModalProps
> = ({
  isOpen,
  isMerging = false,
  targetName,
  sourceName,
  targetNote,
  sourceNote,
  targetDetails,
  sourceDetails,
  error,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      role='alertdialog'
      title={t('catalog.merge.title')}
      onClose={onClose}
      closeLabel={t('common.close')}
      closeOnBackdrop={!isMerging}
      closeOnEscape={!isMerging}
      footer={
        <footer className='catalog-edit-footer'>
          <Button
            variant='secondary'
            onClick={onClose}
            disabled={isMerging}
          >
            {t('catalog.merge.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={() => void onConfirm()}
            disabled={isMerging}
          >
            {isMerging
              ? t('catalog.merge.merging')
              : t('catalog.merge.confirm')}
          </Button>
        </footer>
      }
    >
      <div className='catalog-merge-dialog-content'>
        <p className='muted-copy'>{t('catalog.merge.description')}</p>

        {error ? <InlineError>{error}</InlineError> : null}

        <div className='catalog-merge-records-grid'>
          <div className='catalog-merge-record-card catalog-merge-target-card'>
            <span className='badge badge-success catalog-merge-role-badge'>
              {t('catalog.merge.targetSectionTitle')}
            </span>
            <div className='catalog-merge-record-body'>
              <strong className='catalog-merge-record-name'>
                {targetName}
              </strong>
              {targetNote ? (
                <p className='catalog-merge-record-note'>
                  <span>{t('catalog.filters.note')}:</span>{' '}
                  {targetNote}
                </p>
              ) : null}
              {targetDetails}
            </div>
            <p className='catalog-merge-subtext'>
              {t('catalog.merge.survivorNotice', {
                name: targetName,
              })}
            </p>
          </div>

          <div className='catalog-merge-record-card catalog-merge-source-card'>
            <span className='badge badge-warning catalog-merge-role-badge'>
              {t('catalog.merge.sourceSectionTitle')}
            </span>
            <div className='catalog-merge-record-body'>
              <strong className='catalog-merge-record-name'>
                {sourceName}
              </strong>
              {sourceNote ? (
                <p className='catalog-merge-record-note'>
                  <span>{t('catalog.filters.note')}:</span>{' '}
                  {sourceNote}
                </p>
              ) : null}
              {sourceDetails}
            </div>
            <p className='catalog-merge-subtext'>
              {t('catalog.merge.removalNotice')}
            </p>
          </div>
        </div>

        <div className='catalog-merge-info-list'>
          <p className='muted-copy'>
            &bull; {t('catalog.merge.notesNotice')}
          </p>
          <p className='muted-copy'>
            &bull; {t('catalog.merge.relinkNotice')}
          </p>
        </div>
      </div>
    </Modal>
  );
};
