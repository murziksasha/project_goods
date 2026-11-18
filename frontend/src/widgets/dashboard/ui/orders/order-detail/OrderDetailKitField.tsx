import type React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addSaleKitItems,
  formatSaleKit,
  removeSaleKitItem,
  saleKitMaxItemLength,
  saleKitMaxItems,
} from '../../../../../entities/sale';
import { ChipListInput } from '../../../../../shared/ui/ChipListInput';
import { CopyableValue } from '../../../../../shared/ui/CopyableValue';
import type { SaleKitChange } from '../workspace/orders-workspace-shared';

export interface OrderDetailKitFieldProps {
  saleId: string;
  /** Resolved kit: the `kit` field (comma items split) or the legacy note fallback. */
  kit: string[];
  canEdit: boolean;
  /** Persists the whole next kit immediately and logs one history entry. Rejects on failure. */
  onChangeKit: (kit: string[], change: SaleKitChange) => Promise<void>;
}

/**
 * Main-information row of a repair card: kit chips with "×" and an add input.
 * Every add / remove saves at once (optimistic, reverted on error).
 */
export const OrderDetailKitField: React.FC<OrderDetailKitFieldProps> = ({
  saleId,
  kit,
  canEdit,
  onChangeKit,
}) => {
  const { t } = useTranslation();
  const [optimisticKit, setOptimisticKit] = useState<string[] | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const kitKey = kit.join('\u0000');

  useEffect(() => {
    setOptimisticKit(null);
  }, [saleId, kitKey]);

  useEffect(() => {
    setInputValue('');
  }, [saleId]);

  const items = optimisticKit ?? kit;

  const persist = async (next: string[], change: SaleKitChange, restoreInput = '') => {
    setOptimisticKit(next);
    setIsSaving(true);
    try {
      await onChangeKit(next, change);
    } catch {
      // The workspace shows the error; revert the optimistic change.
      setOptimisticKit(null);
      if (restoreInput) setInputValue(restoreInput);
    } finally {
      setIsSaving(false);
    }
  };

  const addItems = () => {
    if (isSaving) return;
    const typed = inputValue;
    const { kit: next, added } = addSaleKitItems(items, typed);
    setInputValue('');
    if (added.length === 0) return;
    void persist(next, { type: 'add', items: added }, typed);
  };

  const removeItem = (index: number) => {
    if (isSaving) return;
    const { kit: next, removed } = removeSaleKitItem(items, index);
    if (removed === undefined) return;
    void persist(next, { type: 'remove', items: [removed] });
  };

  const chips = (
    <ChipListInput
      className='order-detail-kit-chips'
      label={t('orders.detail.kit')}
      items={items}
      inputValue={inputValue}
      onInputChange={setInputValue}
      onAdd={addItems}
      onRemove={removeItem}
      placeholder={t('orders.detail.kitInputPlaceholder')}
      addLabel={t('orders.create.addKitItem')}
      getRemoveLabel={(item) => t('orders.create.removeKitItem', { item })}
      emptyText={t('orders.detail.kitEmpty')}
      readOnly={!canEdit}
      disabled={isSaving}
      maxItems={saleKitMaxItems}
      maxItemLength={saleKitMaxItemLength}
    />
  );

  return (
    <div className='order-detail-kit-row'>
      <dt>{t('orders.detail.kit')}</dt>
      <dd className='order-detail-kit-value'>
        {canEdit ? (
          chips
        ) : (
          <CopyableValue value={formatSaleKit(items)} className='order-detail-copy-value'>
            {chips}
          </CopyableValue>
        )}
      </dd>
    </div>
  );
};
