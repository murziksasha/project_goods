import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../../../../entities/product/model/types';
import type { SupplierOrder } from '../../../../../entities/supplier-order/model/types';
import type { WarehouseItem } from '../../../../../entities/warehouse-settings/model/types';
import { formatCurrency, formatDateTime } from '../../../../../shared/lib/format';
import {
  filterProductsByWarehouse,
  getDefaultWarehouseId,
  getWarehouseFilteredProductsOldestFirst,
  selectOldestSerialsForWarehouse,
} from '../../../model/warehouse-serial-filter';
import { normalizeSerialNumber } from '../../../model/order-line-serials';
import { buildSupplierOrdersByProductId } from '../../../model/stock-balance';
import { Modal } from '../../../../../shared/ui/Modal';
import { Button } from '../../../../../shared/ui/Button';
import { CopyableValue } from '../../../../../shared/ui/CopyableValue';
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

const EMPTY_SUPPLIER_ORDERS: SupplierOrder[] = [];
const EMPTY_VALUE = '\u2014';

const stopRowToggle = (event: MouseEvent<HTMLElement>) => {
  event.stopPropagation();
};

type SerialBindModalProps = {
  lineItem: SerialBindLineItem;
  warehouses: WarehouseItem[];
  availableProducts: Product[];
  supplierOrders?: SupplierOrder[];
  isLoading: boolean;
  isSuppliersLoading: boolean;
  onClose: () => void;
  onOrder: () => void;
  onSave: (selectedSerials: string[]) => void;
  onError: (message: string) => void;
  onOpenSupplierOrder?: (supplierOrderId: string, itemIndex: number) => void;
};

export const SerialBindModal = ({
  lineItem,
  warehouses,
  availableProducts,
  supplierOrders = EMPTY_SUPPLIER_ORDERS,
  isLoading,
  isSuppliersLoading,
  onClose,
  onOrder,
  onSave,
  onError,
  onOpenSupplierOrder,
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

  const supplierOrdersByProductId = useMemo(
    () =>
      buildSupplierOrdersByProductId({
        products: warehouseFilteredProducts,
        supplierOrders,
      }),
    [supplierOrders, warehouseFilteredProducts],
  );

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
    <Modal
      isOpen
      title={t('orders.detail.lineItems.bindSerialNumbers')}
      onClose={onClose}
      closeLabel={t('common.close')}
      shellClassName="payment-modal payment-modal-message serial-bind-modal modal-dialog"
      bodyClassName="serial-bind-modal-scroll payment-modal-body"
      footer={
        <div className="modal-actions serial-bind-modal-footer">
          <Button
            variant="primary"
            onClick={onOrder}
            disabled={isSuppliersLoading}
          >
            {isSuppliersLoading
              ? t('orders.detail.lineItems.loading')
              : t('orders.detail.lineItems.order')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('orders.detail.cancel')}
          </Button>
          <Button variant="primary" onClick={() => onSave(selectedSerials)}>
            {t('orders.detail.lineItems.save')}
          </Button>
        </div>
      }
    >
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
        <Button
          variant="secondary"
          onClick={handleAutoSelectOldest}
          disabled={isLoading || warehouseFilteredProducts.length === 0}
        >
          {t('orders.detail.lineItems.autoSelectOldest')}
        </Button>
      </div>
      <div className="create-suggestions line-item-suggestions">
        {isLoading || warehouses.length === 0 ? (
          <p>{t('orders.detail.lineItems.loadingAvailableSerials')}</p>
        ) : null}
        {!isLoading && warehouseFilteredProducts.length === 0 ? (
          <p>{t('orders.detail.lineItems.noAvailableSerials')}</p>
        ) : null}
        {warehouseFilteredProducts.length > 0 ? (
          <div className="serial-bind-candidate-header" aria-hidden="true">
            <span>{t('catalog.productModel.serialNumber')}</span>
            <span>{t('catalog.productModel.purchasePrice')}</span>
            <span>{t('catalog.productModel.purchaseDate')}</span>
            <span>{t('catalog.productModel.supplierOrder')}</span>
          </div>
        ) : null}
        {warehouseFilteredProducts.map((product) => {
          const serial = normalizeSerialNumber(product.serialNumber);
          const isSelected = selectedSerials.includes(serial);
          const link = supplierOrdersByProductId[product.id]?.[0];
          const supplierOrderNumber = link?.displayNumber ?? '';
          const supplierOrderId = link?.order.id;
          const supplierOrderItemIndex = link?.itemIndex;
          const canOpenSupplierOrder =
            Boolean(onOpenSupplierOrder) &&
            Boolean(supplierOrderId) &&
            typeof supplierOrderItemIndex === 'number';

          return (
            <div
              key={product.id}
              className={`serial-bind-candidate${
                isSelected ? ' serial-bind-candidate-selected' : ''
              }`}
              onClick={() => toggleSerial(serial)}
            >
              <button
                type="button"
                className="serial-bind-candidate-toggle"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleSerial(serial);
                }}
              >
                <strong>
                  {isSelected ? '[x] ' : '[ ] '}
                  {serial}
                </strong>
              </button>
              <span className="serial-bind-candidate-price">
                {formatCurrency(product.price)}
              </span>
              <span className="serial-bind-candidate-date">
                {t('orders.detail.lineItems.dateLabel', {
                  date: formatDateTime(
                    product.purchaseDate ?? product.createdAt,
                  ),
                })}
              </span>
              <div
                className="serial-bind-candidate-supplier"
                onClick={stopRowToggle}
                onMouseDown={stopRowToggle}
              >
                {supplierOrderNumber ? (
                  <CopyableValue value={supplierOrderNumber}>
                    {canOpenSupplierOrder ? (
                      <button
                        type="button"
                        className="supplier-order-number-button"
                        onClick={() => {
                          if (
                            !onOpenSupplierOrder ||
                            !supplierOrderId ||
                            typeof supplierOrderItemIndex !== 'number'
                          ) {
                            return;
                          }
                          onOpenSupplierOrder(
                            supplierOrderId,
                            supplierOrderItemIndex,
                          );
                        }}
                      >
                        {supplierOrderNumber}
                      </button>
                    ) : (
                      <span>{supplierOrderNumber}</span>
                    )}
                  </CopyableValue>
                ) : (
                  <span className="serial-bind-candidate-empty">
                    {EMPTY_VALUE}
                  </span>
                )}
              </div>
            </div>
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
          <Button variant="secondary" onClick={() => setSelectedSerials([])}>
            {t('orders.detail.lineItems.clearSelected')}
          </Button>
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
    </Modal>
  );
};