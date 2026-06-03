import type { Dispatch, SetStateAction } from 'react';
import type { Product } from '../../../entities/product/model/types';
import { formatDate } from '../../../shared/lib/format';
import type {
  ProductWarehouseMeta,
  TransferFormState,
  TransferHistoryRow,
  WarehouseLocation,
  WarehouseItem,
} from '../model/warehouse-panel';

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
  const currentMeta = selectedProduct
    ? productWarehouseMetaById[selectedProduct.id]
    : undefined;
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

  return (
    <section className='warehouse-transfer-panel'>
      <div className='warehouse-transfer-grid'>
        <div className='warehouse-transfer-form'>
          <label className='orders-filter-field'>
            <span>Product</span>
            <select
              value={form.productId}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  productId: event.target.value,
                }))
              }
              disabled={isSaving}
            >
              <option value=''>Select stock item</option>
              {selectableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {`${product.name} / ${product.serialNumber || product.article}`}
                </option>
              ))}
            </select>
          </label>

          <div className='warehouse-transfer-current'>
            <span>Current location</span>
            <strong>
              {currentMeta
                ? `${currentMeta.warehouseName} / ${currentMeta.locationName}`
                : '-'}
            </strong>
          </div>

          <label className='orders-filter-field'>
            <span>Target warehouse</span>
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
                  ? 'Create warehouse in Settings'
                  : 'Select warehouse'}
              </option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Target location</span>
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
                <option value=''>Create location in Settings</option>
              ) : null}
              {targetLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field warehouse-transfer-note'>
            <span>Note</span>
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
              placeholder='Reason or document number'
            />
          </label>

          <div className='warehouse-transfer-actions'>
            <button
              type='button'
              className='orders-create-button'
              onClick={onSubmit}
              disabled={!canSubmit}
            >
              {isSaving ? 'Transferring...' : 'Transfer stock'}
            </button>
          </div>
        </div>

        <div
          className='catalog-table-wrap warehouse-transfer-list'
          data-global-scrollbar='off'
        >
          <table className='catalog-table'>
            <thead>
              <tr>
                <th>Product</th>
                <th>Serial #</th>
                <th>Warehouse</th>
                <th>Location</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5}>No stock rows found.</td>
                </tr>
              ) : (
                products.map((product) => {
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
                      onClick={() =>
                        onFormChange((current) => ({
                          ...current,
                          productId: product.id,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') {
                          return;
                        }
                        event.preventDefault();
                        onFormChange((current) => ({
                          ...current,
                          productId: product.id,
                        }));
                      }}
                    >
                      <td className='catalog-name-cell'>{product.name}</td>
                      <td>{product.serialNumber || '-'}</td>
                      <td>{meta?.warehouseName ?? '-'}</td>
                      <td>{meta?.locationName ?? '-'}</td>
                      <td>{product.quantity}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className='warehouse-transfer-history'>
        <table className='catalog-table'>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>From</th>
              <th>To</th>
              <th>By</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6}>No transfers in this session.</td>
              </tr>
            ) : (
              history.map((transfer) => (
                <tr key={transfer.id}>
                  <td>{formatDate(transfer.createdAt)}</td>
                  <td>
                    {transfer.productName}
                    {transfer.serialNumber
                      ? ` / ${transfer.serialNumber}`
                      : ''}
                  </td>
                  <td>
                    {transfer.fromWarehouseName} /{' '}
                    {transfer.fromLocationName}
                  </td>
                  <td>
                    {transfer.toWarehouseName} / {transfer.toLocationName}
                  </td>
                  <td>{transfer.createdBy}</td>
                  <td>{transfer.note || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

