import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../../../entities/product/model/types';
import { formatDate } from '../../../../shared/lib/format';
import type {
  ProductWarehouseMeta,
  TransferFormState,
  TransferHistoryRow,
  WarehouseLocation,
  WarehouseItem,
} from '../../model/warehouse-panel';

const locationLabel = (warehouseName?: string, locationName?: string) => {
  if (!warehouseName && !locationName) return '';
  return `${warehouseName ?? '-'} / ${locationName ?? '-'}`;
};

export const TransferWorkspace = ({
  products,
  selectableProducts,
  warehouses,
  productWarehouseMetaById,
  form,
  selectedProduct,
  targetLocations,
  history,
  isSaving,
  onFormChange,
  onSubmit,
}: {
  products: Product[];
  selectableProducts: Product[];
  warehouses: WarehouseItem[];
  productWarehouseMetaById: Record<string, ProductWarehouseMeta>;
  form: TransferFormState;
  selectedProduct: Product | null;
  targetLocations: WarehouseLocation[];
  history: TransferHistoryRow[];
  isSaving: boolean;
  onFormChange: Dispatch<SetStateAction<TransferFormState>>;
  onSubmit: () => void;
}) => {
  const { t } = useTranslation();
  const currentMeta = selectedProduct
    ? productWarehouseMetaById[selectedProduct.id]
    : undefined;
  const targetWarehouse = warehouses.find(
    (warehouse) => warehouse.id === form.toWarehouseId,
  );
  const targetLocation = targetLocations.find(
    (location) => location.id === form.toLocationId,
  );
  const fromLabel = locationLabel(
    currentMeta?.warehouseName,
    currentMeta?.locationName,
  );
  const toLabel = locationLabel(targetWarehouse?.name, targetLocation?.name);
  const isSameLocation =
    Boolean(selectedProduct) &&
    currentMeta?.warehouseId === form.toWarehouseId &&
    currentMeta?.locationId === form.toLocationId;
  const canSubmit =
    Boolean(selectedProduct) &&
    Boolean(form.toWarehouseId) &&
    Boolean(form.toLocationId) &&
    !isSameLocation &&
    !isSaving;
  const submitHint = !selectedProduct
    ? t('warehouse.transfer.warnings.selectProduct')
    : !form.toWarehouseId || !form.toLocationId
      ? t('warehouse.messages.errors.selectTarget')
      : isSameLocation
        ? t('warehouse.messages.errors.alreadyInLocation')
        : null;

  const destinationShares = useMemo(() => {
    if (history.length === 0) return [];
    const counts = new Map<string, number>();
    for (const row of history) {
      const key = locationLabel(row.toWarehouseName, row.toLocationName);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        percent: Math.round((count / history.length) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [history]);

  const selectProduct = (productId: string) => {
    onFormChange((current) => ({
      ...current,
      productId,
    }));
  };

  return (
    <section className='warehouse-transfer-panel'>
      <p className='warehouse-transfer-lead'>
        {t('warehouse.transfer.subtitle')}
      </p>

      <div className='finance-report-grid finance-report-grid-wide warehouse-transfer-summary'>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.transfer.kpi.movable')}
          </span>
          <strong>{selectableProducts.length}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.transfer.kpi.session')}
          </span>
          <strong>{history.length}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.transfer.kpi.destinations')}
          </span>
          <strong>{destinationShares.length}</strong>
        </article>
      </div>

      <div className='warehouse-transfer-grid'>
        <div className='warehouse-transfer-form'>
          <div className='warehouse-transfer-route' aria-live='polite'>
            <div
              className={
                fromLabel
                  ? 'warehouse-transfer-route-node'
                  : 'warehouse-transfer-route-node warehouse-transfer-route-node-empty'
              }
            >
              <span>{t('warehouse.transfer.route.from')}</span>
              <strong>{fromLabel || t('warehouse.transfer.route.empty')}</strong>
            </div>
            <span className='warehouse-transfer-route-arrow' aria-hidden='true'>
              →
            </span>
            <div
              className={
                toLabel
                  ? 'warehouse-transfer-route-node warehouse-transfer-route-node-target'
                  : 'warehouse-transfer-route-node warehouse-transfer-route-node-empty'
              }
            >
              <span>{t('warehouse.transfer.route.to')}</span>
              <strong>{toLabel || t('warehouse.transfer.route.empty')}</strong>
            </div>
          </div>

          <label className='orders-filter-field'>
            <span>{t('warehouse.transfer.product')}</span>
            <select
              value={form.productId}
              onChange={(event) => selectProduct(event.target.value)}
              disabled={isSaving}
            >
              <option value=''>{t('warehouse.transfer.selectStockItem')}</option>
              {selectableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {`${product.name} / ${product.serialNumber || product.article}`}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>{t('warehouse.transfer.targetWarehouse')}</span>
            <select
              value={form.toWarehouseId}
              onChange={(event) => {
                const nextWarehouseId = event.target.value;
                const nextWarehouse = warehouses.find(
                  (warehouse) => warehouse.id === nextWarehouseId,
                );
                onFormChange((current) => ({
                  ...current,
                  toWarehouseId: nextWarehouseId,
                  toLocationId: nextWarehouse?.locations[0]?.id ?? '',
                }));
              }}
              disabled={isSaving || warehouses.length === 0}
            >
              <option value=''>
                {warehouses.length === 0
                  ? t('warehouse.transfer.createWarehouseInSettings')
                  : t('warehouse.transfer.selectWarehouse')}
              </option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>{t('warehouse.transfer.targetLocation')}</span>
            <select
              value={form.toLocationId}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  toLocationId: event.target.value,
                }))
              }
              disabled={isSaving || targetLocations.length === 0}
            >
              {targetLocations.length === 0 ? (
                <option value=''>
                  {t('warehouse.transfer.createLocationInSettings')}
                </option>
              ) : null}
              {targetLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field warehouse-transfer-note'>
            <span>{t('warehouse.transfer.note')}</span>
            <textarea
              value={form.note}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              disabled={isSaving}
              rows={3}
              placeholder={t('warehouse.transfer.notePlaceholder')}
            />
          </label>

          {submitHint && !canSubmit ? (
            <p
              className={
                isSameLocation
                  ? 'warehouse-transfer-hint warehouse-transfer-hint-warn'
                  : 'warehouse-transfer-hint'
              }
            >
              {submitHint}
            </p>
          ) : null}

          <div className='warehouse-transfer-actions'>
            <button
              type='button'
              className='orders-create-button'
              onClick={onSubmit}
              disabled={!canSubmit}
            >
              {isSaving
                ? t('warehouse.transfer.transferring')
                : t('warehouse.transfer.transferStock')}
            </button>
          </div>

          {destinationShares.length > 0 ? (
            <div className='warehouse-transfer-destinations'>
              <span className='metric-label'>
                {t('warehouse.transfer.destinationsTitle')}
              </span>
              {destinationShares.map((share) => (
                <div
                  key={share.label}
                  className='warehouse-transfer-destination-row'
                >
                  <div className='warehouse-transfer-destination-meta'>
                    <strong>{share.label}</strong>
                    <span>{share.count}</span>
                  </div>
                  <span className='warehouse-info-share-track' aria-hidden='true'>
                    <span style={{ width: `${Math.max(share.percent, 8)}%` }} />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className='warehouse-transfer-list-card'>
          <h3 className='warehouse-transfer-section-title'>
            {t('warehouse.transfer.stockTable.title')}
          </h3>
          {products.length === 0 ? (
            <p className='empty-state warehouse-transfer-empty'>
              {t('warehouse.transfer.stockTable.empty')}
            </p>
          ) : (
            <div
              className='catalog-table-wrap warehouse-transfer-list'
              data-global-scrollbar='off'
            >
              <table className='catalog-table table-card-stack'>
                <thead>
                  <tr>
                    <th>{t('warehouse.transfer.stockTable.columns.product')}</th>
                    <th>{t('warehouse.transfer.stockTable.columns.serial')}</th>
                    <th>{t('warehouse.transfer.stockTable.columns.warehouse')}</th>
                    <th>{t('warehouse.transfer.stockTable.columns.location')}</th>
                    <th>{t('warehouse.transfer.stockTable.columns.qty')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const meta = productWarehouseMetaById[product.id];
                    return (
                      <tr
                        key={product.id}
                        className={
                          product.id === form.productId
                            ? 'warehouse-transfer-row warehouse-transfer-row-selected'
                            : 'warehouse-transfer-row'
                        }
                        role='button'
                        tabIndex={0}
                        aria-pressed={product.id === form.productId}
                        onClick={() => selectProduct(product.id)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') {
                            return;
                          }
                          event.preventDefault();
                          selectProduct(product.id);
                        }}
                      >
                        <td
                          className='catalog-name-cell'
                          data-label={t(
                            'warehouse.transfer.stockTable.columns.product',
                          )}
                        >
                          {product.name}
                        </td>
                        <td
                          data-label={t(
                            'warehouse.transfer.stockTable.columns.serial',
                          )}
                        >
                          {product.serialNumber || '-'}
                        </td>
                        <td
                          data-label={t(
                            'warehouse.transfer.stockTable.columns.warehouse',
                          )}
                        >
                          {meta?.warehouseName ?? '-'}
                        </td>
                        <td
                          data-label={t(
                            'warehouse.transfer.stockTable.columns.location',
                          )}
                        >
                          {meta?.locationName ?? '-'}
                        </td>
                        <td
                          data-label={t(
                            'warehouse.transfer.stockTable.columns.qty',
                          )}
                        >
                          {product.quantity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className='warehouse-transfer-history'>
        <h3 className='warehouse-transfer-section-title'>
          {t('warehouse.transfer.historyTable.title')}
        </h3>
        {history.length === 0 ? (
          <p className='empty-state warehouse-transfer-empty'>
            {t('warehouse.transfer.historyTable.empty')}
          </p>
        ) : (
          <div className='catalog-table-wrap' data-global-scrollbar='off'>
            <table className='catalog-table table-card-stack'>
              <thead>
                <tr>
                  <th>{t('warehouse.transfer.historyTable.columns.date')}</th>
                  <th>{t('warehouse.transfer.historyTable.columns.product')}</th>
                  <th>{t('warehouse.transfer.historyTable.columns.from')}</th>
                  <th>{t('warehouse.transfer.historyTable.columns.to')}</th>
                  <th>{t('warehouse.transfer.historyTable.columns.by')}</th>
                  <th>{t('warehouse.transfer.historyTable.columns.note')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((transfer) => (
                  <tr key={transfer.id}>
                    <td
                      data-label={t(
                        'warehouse.transfer.historyTable.columns.date',
                      )}
                    >
                      {formatDate(transfer.createdAt)}
                    </td>
                    <td
                      data-label={t(
                        'warehouse.transfer.historyTable.columns.product',
                      )}
                    >
                      {transfer.productName}
                      {transfer.serialNumber
                        ? ` / ${transfer.serialNumber}`
                        : ''}
                    </td>
                    <td
                      data-label={t(
                        'warehouse.transfer.historyTable.columns.from',
                      )}
                    >
                      <span className='warehouse-info-chip'>
                        {locationLabel(
                          transfer.fromWarehouseName,
                          transfer.fromLocationName,
                        )}
                      </span>
                    </td>
                    <td
                      data-label={t(
                        'warehouse.transfer.historyTable.columns.to',
                      )}
                    >
                      <span className='warehouse-info-chip'>
                        {locationLabel(
                          transfer.toWarehouseName,
                          transfer.toLocationName,
                        )}
                      </span>
                    </td>
                    <td
                      data-label={t(
                        'warehouse.transfer.historyTable.columns.by',
                      )}
                    >
                      {transfer.createdBy}
                    </td>
                    <td
                      data-label={t(
                        'warehouse.transfer.historyTable.columns.note',
                      )}
                    >
                      {transfer.note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
