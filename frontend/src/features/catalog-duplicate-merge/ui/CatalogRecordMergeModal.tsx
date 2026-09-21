import type React from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDismissibleSuggestions } from '../../../shared/lib/useDismissibleSuggestions';
import { Modal } from '../../../shared/ui/Modal';
import { Button } from '../../../shared/ui/Button';
import { InlineError } from '../../../shared/ui/InlineError';

export interface CatalogRecordMergeModalProps<T> {
  isOpen: boolean;
  title: string;
  records: T[];
  isSaving?: boolean;
  onClose: () => void;
  onMerge: (
    targetId: string,
    sourceId: string,
  ) => Promise<boolean | void>;
  getRecordId: (record: T) => string;
  getRecordName: (record: T) => string;
  getRecordSecondaryText?: (record: T) => string | undefined;
  getRecordNote?: (record: T) => string | undefined;
  searchPlaceholder?: string;
}

export const CatalogRecordMergeModal = <T,>({
  isOpen,
  title,
  records,
  isSaving = false,
  onClose,
  onMerge,
  getRecordId,
  getRecordName,
  getRecordSecondaryText,
  getRecordNote,
  searchPlaceholder,
}: CatalogRecordMergeModalProps<T>): React.ReactElement | null => {
  const { t } = useTranslation();

  const [targetRecord, setTargetRecord] = useState<T | null>(null);
  const [sourceRecord, setSourceRecord] = useState<T | null>(null);
  const [targetQuery, setTargetQuery] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  const [showTargetSuggestions, setShowTargetSuggestions] =
    useState(false);
  const [showSourceSuggestions, setShowSourceSuggestions] =
    useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const effectivePlaceholder =
    searchPlaceholder ??
    t('catalog.recordMergeModal.searchPlaceholder');

  const targetOptions = useMemo(() => {
    const q = targetQuery.trim().toLowerCase();
    if (!q) return records.slice(0, 15);
    return records
      .filter((rec) => {
        const name = getRecordName(rec).toLowerCase();
        if (name.includes(q)) return true;
        const sec = getRecordSecondaryText?.(rec)?.toLowerCase();
        return Boolean(sec && sec.includes(q));
      })
      .slice(0, 15);
  }, [records, targetQuery, getRecordName, getRecordSecondaryText]);

  const sourceOptions = useMemo(() => {
    const q = sourceQuery.trim().toLowerCase();
    if (!q) return records.slice(0, 15);
    return records
      .filter((rec) => {
        const name = getRecordName(rec).toLowerCase();
        if (name.includes(q)) return true;
        const sec = getRecordSecondaryText?.(rec)?.toLowerCase();
        return Boolean(sec && sec.includes(q));
      })
      .slice(0, 15);
  }, [records, sourceQuery, getRecordName, getRecordSecondaryText]);

  const { rootRef: targetRootRef, isVisible: isTargetVisible } =
    useDismissibleSuggestions({
      query: targetQuery,
      isActive: showTargetSuggestions && targetOptions.length > 0,
    });

  const { rootRef: sourceRootRef, isVisible: isSourceVisible } =
    useDismissibleSuggestions({
      query: sourceQuery,
      isActive: showSourceSuggestions && sourceOptions.length > 0,
    });

  const handleSelectTarget = (record: T) => {
    setTargetRecord(record);
    setTargetQuery(getRecordName(record));
    setShowTargetSuggestions(false);
    setError(null);
  };

  const handleSelectSource = (record: T) => {
    setSourceRecord(record);
    setSourceQuery(getRecordName(record));
    setShowSourceSuggestions(false);
    setError(null);
  };

  const handleSwap = () => {
    const prevTarget = targetRecord;
    const prevTargetQuery = targetQuery;
    setTargetRecord(sourceRecord);
    setTargetQuery(sourceQuery);
    setSourceRecord(prevTarget);
    setSourceQuery(prevTargetQuery);
    setShowTargetSuggestions(false);
    setShowSourceSuggestions(false);
    setError(null);
  };

  const targetId = targetRecord ? getRecordId(targetRecord) : '';
  const sourceId = sourceRecord ? getRecordId(sourceRecord) : '';
  const isSameRecord = Boolean(
    targetId && sourceId && targetId === sourceId,
  );
  const isBusy = isSaving || isMerging;
  const canMerge = Boolean(
    targetId && sourceId && !isSameRecord && !isBusy,
  );

  const handleConfirmMerge = async () => {
    if (!canMerge || !targetRecord || !sourceRecord) return;
    setIsMerging(true);
    setError(null);
    try {
      const result = await onMerge(targetId, sourceId);
      if (result !== false) {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      role='dialog'
      title={title}
      onClose={onClose}
      closeLabel={t('common.close')}
      closeOnBackdrop={!isBusy}
      closeOnEscape={!isBusy}
      footer={
        <footer className='catalog-edit-footer'>
          <Button
            variant='secondary'
            onClick={onClose}
            disabled={isBusy}
          >
            {t('catalog.merge.cancel')}
          </Button>
          <Button
            variant='primary'
            onClick={() => void handleConfirmMerge()}
            disabled={!canMerge}
          >
            {isBusy
              ? t('catalog.recordMergeModal.merging')
              : t('catalog.recordMergeModal.merge')}
          </Button>
        </footer>
      }
    >
      <div className='catalog-merge-dialog-content'>
        <p className='muted-copy'>
          {t('catalog.recordMergeModal.description')}
        </p>

        {error ? <InlineError>{error}</InlineError> : null}
        {isSameRecord ? (
          <InlineError>
            {t('catalog.recordMergeModal.differentRecordsWarning')}
          </InlineError>
        ) : null}

        <label
          ref={targetRootRef}
          className='field field-wide modal-suggestions-anchor'
        >
          <span>{t('catalog.recordMergeModal.targetLabel')}</span>
          <input
            value={targetQuery}
            placeholder={effectivePlaceholder}
            aria-label={t('catalog.recordMergeModal.targetLabel')}
            onChange={(event) => {
              const value = event.target.value;
              setTargetQuery(value);
              setShowTargetSuggestions(true);
              if (
                targetRecord &&
                getRecordName(targetRecord) !== value
              ) {
                setTargetRecord(null);
              }
            }}
          />
          {isTargetVisible ? (
            <div className='suggestions-panel'>
              {targetOptions.map((item) => {
                const id = getRecordId(item);
                const name = getRecordName(item);
                const sec = getRecordSecondaryText?.(item);
                return (
                  <button
                    key={id}
                    type='button'
                    className='suggestion-item'
                    onClick={() => handleSelectTarget(item)}
                  >
                    <strong>{name}</strong>
                    {sec ? <span>{sec}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </label>

        <div
          className='catalog-merge-swap-row'
          style={{
            display: 'flex',
            justifyContent: 'center',
            margin: '4px 0',
          }}
        >
          <Button
            type='button'
            variant='secondary'
            onClick={handleSwap}
            disabled={(!targetRecord && !sourceRecord) || isBusy}
            aria-label={t('catalog.recordMergeModal.swapAriaLabel')}
          >
            ↕ {t('catalog.recordMergeModal.swap')}
          </Button>
        </div>

        <label
          ref={sourceRootRef}
          className='field field-wide modal-suggestions-anchor'
        >
          <span>{t('catalog.recordMergeModal.sourceLabel')}</span>
          <input
            value={sourceQuery}
            placeholder={effectivePlaceholder}
            aria-label={t('catalog.recordMergeModal.sourceLabel')}
            onChange={(event) => {
              const value = event.target.value;
              setSourceQuery(value);
              setShowSourceSuggestions(true);
              if (
                sourceRecord &&
                getRecordName(sourceRecord) !== value
              ) {
                setSourceRecord(null);
              }
            }}
          />
          {isSourceVisible ? (
            <div className='suggestions-panel'>
              {sourceOptions.map((item) => {
                const id = getRecordId(item);
                const name = getRecordName(item);
                const sec = getRecordSecondaryText?.(item);
                return (
                  <button
                    key={id}
                    type='button'
                    className='suggestion-item'
                    onClick={() => handleSelectSource(item)}
                  >
                    <strong>{name}</strong>
                    {sec ? <span>{sec}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </label>

        {targetRecord && sourceRecord && !isSameRecord ? (
          <div
            className='catalog-merge-records-grid'
            style={{ marginTop: '16px' }}
          >
            <div className='catalog-merge-record-card catalog-merge-target-card'>
              <span className='badge badge-success catalog-merge-role-badge'>
                {t('catalog.recordMergeModal.targetSectionTitle')}
              </span>
              <div className='catalog-merge-record-body'>
                <strong className='catalog-merge-record-name'>
                  {getRecordName(targetRecord)}
                </strong>
                {getRecordSecondaryText?.(targetRecord) ? (
                  <p className='catalog-merge-record-note'>
                    {getRecordSecondaryText(targetRecord)}
                  </p>
                ) : null}
                {getRecordNote?.(targetRecord) ? (
                  <p className='catalog-merge-record-note'>
                    <span>{t('catalog.filters.note')}:</span>{' '}
                    {getRecordNote(targetRecord)}
                  </p>
                ) : null}
              </div>
              <p className='catalog-merge-subtext'>
                {t('catalog.merge.survivorNotice', {
                  name: getRecordName(targetRecord),
                })}
              </p>
            </div>

            <div className='catalog-merge-record-card catalog-merge-source-card'>
              <span className='badge badge-warning catalog-merge-role-badge'>
                {t('catalog.recordMergeModal.sourceSectionTitle')}
              </span>
              <div className='catalog-merge-record-body'>
                <strong className='catalog-merge-record-name'>
                  {getRecordName(sourceRecord)}
                </strong>
                {getRecordSecondaryText?.(sourceRecord) ? (
                  <p className='catalog-merge-record-note'>
                    {getRecordSecondaryText(sourceRecord)}
                  </p>
                ) : null}
                {getRecordNote?.(sourceRecord) ? (
                  <p className='catalog-merge-record-note'>
                    <span>{t('catalog.filters.note')}:</span>{' '}
                    {getRecordNote(sourceRecord)}
                  </p>
                ) : null}
              </div>
              <p className='catalog-merge-subtext'>
                {t('catalog.merge.removalNotice')}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};
