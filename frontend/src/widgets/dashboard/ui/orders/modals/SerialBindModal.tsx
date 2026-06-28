import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../../../../entities/product/model/types';
import type { WarehouseItem } from '../../../../../entities/warehouse-settings/model/types';
import { formatDateTime } from '../../../../../shared/lib/format';
import {
  filterProductsByWarehouse,
  getDefaultWarehouseId,
  getWarehouseFilteredProductsOldestFirst,
  selectOldestSerialsForWarehouse,
} from '../../../model/warehouse-serial-filter';
import { normalizeSerialNumber } from '../../../model/order-line-serials';
import { WarehouseSelectField } from '../../warehouse/WarehouseSelectField';

export type SerialBindLineItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  warrantyPeriod: number;
  productId?: string;
  serialNumbers?: string[];
};

type SerialBindModalProps = {
  lineItem: SerialBindLineItem;
  warehouses: WarehouseItem[];
  availableProducts: Product[];
  isLoading: boolean;
  isSuppliersLoading: boolean;
  onClose: () => void;
  onOrder: () => void;
  onSave: (selectedSerials: string[]) => void;
  onError: (message: string) => void;
};

export const SerialBindModal = ({
  lineItem,
  warehouses,
  availableProducts,
  isLoading,
  isSuppliersLoading,
  onClose,
  onOrder,
  onSave,
  onError,
}: SerialBindModalProps) => {
  const { t } = useTranslation();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(() =>
    getDefaultWarehouseId(warehouses),
  );
  const [selectedSerials, setSelectedSerials] = useState<string[]>(() =>
    Array.from(
      new Set(
        (lineItem.serialNumbers ?? [])
          .map(normalizeSerialNumber)
          .filter(Boolean),
      ),
    ),
  );

  useEffect(() => {
    setSelectedSerials(
      Array.from(
        new Set(
          (lineItem.serialNumbers ?? [])
            .map(normalizeSerialNumber)
            .filter(Boolean),
        ),
      ),
    );
  }, [lineItem.id, lineItem.serialNumbers]);

  useEffect(() => {
    setSelectedWarehouseId((current) => {
      if (
        current &&
        warehouses.some((warehouse) => warehouse.id === current)
      ) {
        return current;
      }
      return getDefaultWarehouseId(warehouses);
    });
  }, [warehouses]);

  const warehouseFilteredProducts = useMemo(() => {
    if (warehouses.length === 0 || !selectedWarehouseId) {
      return [];
    }
    return getWarehouseFilteredProductsOldestFirst(
      availableProducts,
      selectedWarehouseId,
      warehouses,
    );
  }, [availableProducts, selectedWarehouseId, warehouses]);

  const handleWarehouseChange = (warehouseId: string) => {
    setSelectedWarehouseId(warehouseId);
    const visibleSerials = new Set(
      filterProductsByWarehouse(availableProducts, warehouseId, warehouses)
        .map((product) => normalizeSerialNumber(product.serialNumber))
        .filter(Boolean),
    );
    setSelectedSerials((current) =>
      current.filter((serial) => visibleSerials.has(serial)),
    );
  };

  const toggleSerial = (serial: string) => {
    setSelectedSerials((current) => {
      if (current.includes(serial)) {
        return current.filter((candidate) => candidate !== serial);
      }
      if (current.length >= lineItem.quantity) {
        onError(t('orders.messages.errors.serialCountExceedsQty'));
        return current;
      }
      return [...current, serial];
    });
  };

  const handleAutoSelectOldest = () => {
    const oldestSerials = selectOldestSerialsForWarehouse(
      availableProducts,
      selectedWarehouseId,
      warehouses,
      lineItem.quantity,
      normalizeSerialNumber,
    );
    setSelectedSerials(oldestSerials);
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="payment-modal payment-modal-message serial-bind-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="serial-bind-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="serial-bind-modal-scroll">
          <h3 id="serial-bind-modal-title">
            {t('orders.detail.lineItems.bindSerialNumbers')}
          </h3>
          <p>
            {t('orders.detail.lineItems.selectSerialsUpTo', {
              count: lineItem.quantity,
            })}
          </p>
          <WarehouseSelectField
            warehouses={warehouses}
            value={selectedWarehouseId}
            onChange={handleWarehouseChange}
            disabled={isLoading}
            labelKey="orders.detail.lineItems.warehouse"
          />
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleAutoSelectOldest}
              disabled={isLoading || warehouseFilteredProducts.length === 0}
            >
              {t('orders.detail.lineItems.autoSelectOldest')}
            </button>
          </div>
          <div className="create-suggestions line-item-suggestions">
            {isLoading || warehouses.length === 0 ? (
              <p>{t('orders.detail.lineItems.loadingAvailableSerials')}</p>
            ) : null}
            {!isLoading && warehouseFilteredProducts.length === 0 ? (
              <p>{t('orders.detail.lineItems.noAvailableSerials')}</p>
            ) : null}
            {warehouseFilteredProducts.map((product) => {
              const serial = normalizeSerialNumber(product.serialNumber);
              const isSelected = selectedSerials.includes(serial);
              return (
                <button
                  key={product.id}
                  type="button"
                  className="create-suggestion-item"
                  onClick={() => toggleSerial(serial)}
                >
                  <strong>
                    {isSelected ? '[x] ' : '[ ] '}
                    {serial}
                  </strong>
                  <span>
                    {t('orders.detail.lineItems.dateLabel', {
                      date: formatDateTime(product.purchaseDate ?? product.createdAt),
                    })}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedSerials.length > 0 ? (
            <div className="modal-actions">
              <span>
                {t('orders.detail.lineItems.selectedCount', {
                  count: selectedSerials.length,
                })}
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedSerials([])}
              >
                {t('orders.detail.lineItems.clearSelected')}
              </button>
            </div>
          ) : null}
          {selectedSerials.length > 0 ? (
            <div className="serial-bind-selected-list">
              {selectedSerials.map((serial) => (
                <div key={`selected-${serial}`} className="serial-bind-selected-item">
                  <strong>{serial}</strong>
                  <button
                    type="button"
                    className="line-item-remove-button"
                    onClick={() =>
                      setSelectedSerials((current) =>
                        current.filter((candidate) => candidate !== serial),
                      )
                    }
                  >
                    {t('orders.detail.lineItems.remove')}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="modal-actions serial-bind-modal-footer">
          <button
            type="button"
            className="primary-button"
            onClick={onOrder}
            disabled={isSuppliersLoading}
          >
            {isSuppliersLoading
              ? t('orders.detail.lineItems.loading')
              : t('orders.detail.lineItems.order')}
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('orders.detail.cancel')}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => onSave(selectedSerials)}
          >
            {t('orders.detail.lineItems.save')}
          </button>
        </div>
      </section>
    </div>
  );
};