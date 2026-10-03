import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfitMarginRow } from '../../../../entities/finance';
import {
  updateProductModelByName,
  useProductsQuery,
} from '../../../../entities/product';
import type { Sale } from '../../../../entities/sale';
import {
  archiveServiceCatalogItem,
  updateServiceCatalogItem,
} from '../../../../entities/service-catalog';
import {
  initialServiceCatalogForm,
  toServiceCatalogForm,
} from '../../../../entities/service-catalog';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../../entities/service-catalog';
import type { SupplierOrder } from '../../../../entities/supplier-order';
import { useWarehouseSettingsQuery } from '../../../../entities/warehouse-settings';
import { queryClient, queryKeys } from '../../../../shared/api/queryClient';
import { ProductModelModal } from '../orders/modals/ProductModelModal';
import { CatalogServiceModal } from '../product-catalog/ProductCatalogModals';
import { resolveProfitReportCatalogTarget } from '../../model/profit-report';

export interface ProfitReportCatalogModalHostProps {
  row: ProfitMarginRow | null;
  services: ServiceCatalogItem[];
  sales: Sale[];
  supplierOrders: SupplierOrder[];
  canWrite: boolean;
  onClose: () => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
  onOpenSupplierOrder?: (supplierOrderId: string, itemIndex: number) => void;
};

const invalidateCatalogQueries = async () => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.products }),
    queryClient.invalidateQueries({ queryKey: queryKeys.services }),
  ]);
};

export const ProfitReportCatalogModalHost: React.FC<ProfitReportCatalogModalHostProps> = ({
  row,
  services,
  sales,
  supplierOrders,
  canWrite,
  onClose,
  onError,
  onSuccess,
  onOpenSupplierOrder,
}) => {
  const { t } = useTranslation();
  const target = useMemo(
    () => (row ? resolveProfitReportCatalogTarget(row, services) : null),
    [row, services],
  );
  const isProduct = target?.kind === 'product';
  const productsQuery = useProductsQuery(isProduct);
  const warehouseSettingsQuery = useWarehouseSettingsQuery(isProduct);
  const service = target?.kind === 'service' ? target.service : null;
  const [serviceForm, setServiceForm] = useState<ServiceCatalogFormValues>(
    initialServiceCatalogForm,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (service) {
      setServiceForm(toServiceCatalogForm(service));
    }
  }, [service]);

  if (!target) return null;

  if (target.kind === 'product') {
    return (
      <ProductModelModal
        name={target.name}
        products={productsQuery.data ?? []}
        sales={sales}
        supplierOrders={supplierOrders}
        warehouses={warehouseSettingsQuery.data?.warehouses ?? []}
        isSaving={isSaving}
        readOnly={!canWrite}
        onClose={onClose}
        onOpenSupplierOrder={onOpenSupplierOrder}
        onSave={async (payload) => {
          if (!canWrite) return false;
          setIsSaving(true);
          try {
            const result = await updateProductModelByName(payload);
            await invalidateCatalogQueries();
            onSuccess?.(t('accounting.profit.catalogSaved'));
            return result.matchedCount > 0;
          } catch (error) {
            onError?.(
              error instanceof Error
                ? error.message
                : t('accounting.profit.loadError'),
            );
            return false;
          } finally {
            setIsSaving(false);
          }
        }}
      />
    );
  }

  const isEditing =
    JSON.stringify(serviceForm) !==
    JSON.stringify(toServiceCatalogForm(target.service));

  return (
    <CatalogServiceModal
      service={target.service}
      catalogNumber={0}
      form={serviceForm}
      isSaving={isSaving}
      isEditing={isEditing}
      readOnly={!canWrite}
      onChange={(field, value) =>
        setServiceForm((current) => ({ ...current, [field]: value }))
      }
      onSubmit={async () => {
        setIsSaving(true);
        try {
          await updateServiceCatalogItem(target.service.id, {
            ...serviceForm,
            isActive: target.service.isActive,
          });
          await invalidateCatalogQueries();
          onSuccess?.(t('accounting.profit.catalogSaved'));
        } catch (error) {
          onError?.(
            error instanceof Error
              ? error.message
              : t('accounting.profit.loadError'),
          );
          throw error;
        } finally {
          setIsSaving(false);
        }
      }}
      onArchive={async () => {
        if (
          !window.confirm(
            t('dashboard.actions.confirms.archiveService', {
              name: target.service.name,
            }),
          )
        ) {
          return;
        }
        setIsSaving(true);
        try {
          await archiveServiceCatalogItem(target.service.id);
          await invalidateCatalogQueries();
          onSuccess?.(t('accounting.profit.catalogRemoved'));
          onClose();
        } catch (error) {
          onError?.(
            error instanceof Error
              ? error.message
              : t('accounting.profit.loadError'),
          );
        } finally {
          setIsSaving(false);
        }
      }}
      onActivate={async () => {
        setIsSaving(true);
        try {
          await updateServiceCatalogItem(target.service.id, {
            ...toServiceCatalogForm(target.service),
            isActive: true,
          });
          await invalidateCatalogQueries();
          onSuccess?.(t('accounting.profit.catalogSaved'));
        } catch (error) {
          onError?.(
            error instanceof Error
              ? error.message
              : t('accounting.profit.loadError'),
          );
        } finally {
          setIsSaving(false);
        }
      }}
      onClose={onClose}
    />
  );
};
