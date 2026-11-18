import type React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  areSaleKitsEqual,
  formatSaleKit,
  normalizeSaleKit,
  saleKitMaxItemLength,
  saleKitMaxItems,
} from '../../../../../entities/sale';
import { StringListInput } from '../../../../../shared/ui/StringListInput';
import { CopyableValue } from '../../../../../shared/ui/CopyableValue';
import { PencilIcon } from '../modals/PencilIcon';

export interface OrderDetailKitFieldProps {
  saleId: string;
  /** Resolved kit: the `kit` field or the legacy `(kits: ...)` note fallback. */
  kit: string[];
  canEdit: boolean;
  onSaveKit: (kit: string[]) => Promise<void>;
}

/** Main-information row of a repair card: view and edit the device kit. */
export const OrderDetailKitField: React.FC<OrderDetailKitFieldProps> = ({
  saleId,
  kit,
  canEdit,
  onSaveKit,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState<string[]>(kit);
  const kitKey = kit.join('\u0000');

  useEffect(() => {
    setDraft(kitKey ? kitKey.split('\u0000') : []);
    setIsEditing(false);
  }, [saleId, kitKey]);

  const kitText = formatSaleKit(kit);

  const cancelEdit = () => {
    setDraft(kit);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    const next = normalizeSaleKit(draft);
    if (areSaleKitsEqual(next, kit)) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSaveKit(next);
      setIsEditing(false);
    } catch {
      // The workspace reports the error; keep the draft for another attempt.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='order-detail-kit-row'>
      <dt>{t('orders.detail.kit')}</dt>
      <dd className='order-detail-kit-value'>
        {isEditing ? (
          <div className='order-detail-kit-edit'>
            <StringListInput
              label={t('orders.detail.kit')}
              items={draft}
              onChange={setDraft}
              placeholder={t('orders.create.kitItemPlaceholder')}
              addLabel={t('orders.create.addKitItem')}
              getRemoveLabel={(item) => t('orders.create.removeKitItem', { item })}
              maxItems={saleKitMaxItems}
              maxItemLength={saleKitMaxItemLength}
              disabled={isSaving}
            />
            <div className='order-detail-note-edit-actions'>
              <button
                type='button'
                className='secondary-button'
                onClick={cancelEdit}
                disabled={isSaving}
              >
                {t('common.cancel')}
              </button>
              <button
                type='button'
                className='primary-button'
                onClick={() => void saveEdit()}
                disabled={isSaving}
              >
                {isSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <CopyableValue value={kitText} className='order-detail-copy-value'>
              <span>{kitText || t('orders.detail.kitEmpty')}</span>
            </CopyableValue>
            {canEdit ? (
              <button
                type='button'
                className='toolbar-square-button order-detail-kit-edit-button'
                onClick={() => setIsEditing(true)}
                aria-label={t('orders.detail.editKit')}
                title={t('orders.detail.editKit')}
              >
                <PencilIcon />
              </button>
            ) : null}
          </>
        )}
      </dd>
    </div>
  );
};
