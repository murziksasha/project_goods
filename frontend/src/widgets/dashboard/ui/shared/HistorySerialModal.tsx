import type React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Employee } from '../../../../entities/employee';
import { hasEmployeePermission } from '../../../../entities/employee';
import { useProductsQuery } from '../../../../entities/product';
import { useSettingsQuery } from '../../../../entities/settings';
import type { Sale } from '../../../../entities/sale';
import { useSupplierOrdersQuery } from '../../../../entities/supplier-order';
import { useWarehouseSettingsQuery } from '../../../../entities/warehouse-settings';
import { Modal } from '../../../../shared/ui';
import { normalizeSerialNumber } from '../../model/order-line-serials';
import { applyPrintFormLocalOverrides } from '../../model/print-form-local-overrides';
import { ProductModelModal } from '../orders/modals/ProductModelModal';

export interface HistorySerialContext {
  name: string;
  serialNumber: string;
  saleId: string;
}

export interface HistorySerialModalProps {
  context: HistorySerialContext;
  currentEmployee: Employee | null;
  sales: Sale[];
  onClose: () => void;
}

export const HistorySerialModal: React.FC<HistorySerialModalProps> = ({
  context,
  currentEmployee,
  sales,
  onClose,
}) => {
  const { t } = useTranslation();
  const canViewSupplierOrders =
    hasEmployeePermission(currentEmployee, 'supplierOrders.view') ||
    hasEmployeePermission(currentEmployee, 'supplierOrders.manage');
  const productsQuery = useProductsQuery();
  const warehousesQuery = useWarehouseSettingsQuery();
  const supplierOrdersQuery = useSupplierOrdersQuery(canViewSupplierOrders);
  // Stock labels use the saved forms (shared settings cache) with local
  // overrides; `null` until loaded, so printing is blocked meanwhile.
  const settingsQuery = useSettingsQuery();
  const settingsPrintForms = settingsQuery.data?.printForms;
  const printForms = useMemo(
    () =>
      settingsPrintForms
        ? applyPrintFormLocalOverrides(settingsPrintForms, currentEmployee?.id)
        : null,
    [currentEmployee?.id, settingsPrintForms],
  );
  const queries = [
    productsQuery,
    warehousesQuery,
    ...(canViewSupplierOrders ? [supplierOrdersQuery] : []),
  ];
  const hasError = queries.some((query) => query.isError);
  const isLoading = queries.some((query) => query.isLoading);

  if (hasError || isLoading) {
    return (
      <Modal
        isOpen
        usePortal
        title={context.name}
        onClose={onClose}
        closeLabel={t('common.close')}
      >
        {hasError ? (
          <div role='alert'>
            <p>{t('orders.create.sidePanel.serialLoadError')}</p>
            <button
              type='button'
              className='secondary-button'
              onClick={() => {
                queries
                  .filter((query) => query.isError)
                  .forEach((query) => void query.refetch());
              }}
            >
              {t('orders.create.sidePanel.retry')}
            </button>
          </div>
        ) : (
          <p role='status'>{t('common.loading')}</p>
        )}
      </Modal>
    );
  }

  const products = productsQuery.data ?? [];
  const product =
    products.find(
      (candidate) =>
        normalizeSerialNumber(candidate.serialNumber) ===
        normalizeSerialNumber(context.serialNumber),
    ) ?? null;

  return (
    <ProductModelModal
      name={product?.name ?? context.name}
      products={products}
      sales={sales}
      currentSaleId={context.saleId}
      supplierOrders={
        canViewSupplierOrders ? supplierOrdersQuery.data : undefined
      }
      warehouses={warehousesQuery.data?.warehouses ?? []}
      printForms={printForms}
      selectedSerial={{ serialNumber: context.serialNumber, product }}
      readOnly
      usePortal
      onClose={onClose}
      onSave={async () => false}
    />
  );
};
