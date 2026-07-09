import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PencilIcon } from '../modals/PencilIcon';

const COLLAPSE_ICON_EXPANDED = '\u2303';
const COLLAPSE_ICON_COLLAPSED = '\u2304';
const MAX_USER_NOTE_LENGTH = 500;

export type OrderDetailNoteSectionProps = {
  saleId: string;
  isSaleCard: boolean;
  systemNote: string;
  userNote: string;
  isNoteOpen: boolean;
  canEdit: boolean;
  isSaving: boolean;
  onToggle: () => void;
  onSaveUserNote: (userNote: string) => Promise<void>;
};

export const OrderDetailNoteSection = ({
  saleId,
  isSaleCard,
  systemNote,
  userNote,
  isNoteOpen,
  canEdit,
  isSaving,
  onToggle,
  onSaveUserNote,
}: OrderDetailNoteSectionProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(userNote);

  useEffect(() => {
    setDraft(userNote);
    setIsEditing(false);
  }, [saleId, userNote]);

  const normalizedSystemNote = systemNote.trim();
  const normalizedUserNote = userNote.trim();
  const showSystemNote = !isSaleCard && normalizedSystemNote.length > 0;
  const showUserNote = normalizedUserNote.length > 0;
  const showEmptyPlaceholder =
    isSaleCard
      ? !showUserNote && !isEditing
      : !showSystemNote && !showUserNote && !isEditing;

  const cancelEdit = () => {
    setDraft(userNote);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    const nextValue = draft.trim();
    if (nextValue === normalizedUserNote) {
      setIsEditing(false);
      return;
    }
    await onSaveUserNote(nextValue);
    setIsEditing(false);
  };

  return (
    <section className='order-detail-panel order-detail-note'>
      <div className='order-detail-note-header'>
        <button
          type='button'
          className='order-detail-collapse-button order-detail-note-toggle'
          onClick={onToggle}
          aria-expanded={isNoteOpen}
        >
          <span>{t('orders.detail.notes')}</span>
          <span className='order-detail-collapse-icon' aria-hidden='true'>
            {isNoteOpen ? COLLAPSE_ICON_EXPANDED : COLLAPSE_ICON_COLLAPSED}
          </span>
        </button>
        {isNoteOpen && canEdit && !isEditing ? (
          <button
            type='button'
            className='toolbar-square-button order-detail-note-edit-button'
            onClick={() => setIsEditing(true)}
            aria-label={t('orders.detail.editNote')}
            title={t('orders.detail.editNote')}
            disabled={isSaving}
          >
            <PencilIcon />
          </button>
        ) : null}
      </div>
      {isNoteOpen ? (
        <div className='order-detail-note-body'>
          {showSystemNote ? (
            <p className='order-detail-note-system'>{normalizedSystemNote}</p>
          ) : null}
          {isEditing ? (
            <div className='order-detail-note-edit'>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={4}
                maxLength={MAX_USER_NOTE_LENGTH}
                placeholder={t('orders.detail.userNotePlaceholder')}
                disabled={isSaving}
              />
              <p className='muted-copy'>
                {draft.length}/{MAX_USER_NOTE_LENGTH}
              </p>
              <div className='order-detail-note-edit-actions'>
                <button
                  type='button'
                  className='secondary-button'
                  onClick={cancelEdit}
                  disabled={isSaving}
                >
                  {t('orders.detail.cancelNoteEdit')}
                </button>
                <button
                  type='button'
                  className='primary-button'
                  onClick={() => void saveEdit()}
                  disabled={isSaving}
                >
                  {isSaving
                    ? t('orders.payment.saving')
                    : t('orders.detail.saveNote')}
                </button>
              </div>
            </div>
          ) : showUserNote ? (
            <p className='order-detail-note-user'>{normalizedUserNote}</p>
          ) : null}
          {showEmptyPlaceholder ? (
            <p className='order-detail-note-empty'>
              {isSaleCard
                ? t('orders.detail.noNotesSale')
                : t('orders.detail.noNotesOrder')}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};