import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogProduct } from '../../../../entities/catalog-product/model/types';
import {
  deleteCatalogProduct,
  updateCatalogProduct,
} from '../../../../entities/catalog-product/api/catalogProductApi';
import type { ProfitMarginRow } from '../../../../entities/finance/model/types';
import {
  archiveServiceCatalogItem,
  updateServiceCatalogItem,
} from '../../../../entities/service-catalog/api/serviceCatalogApi';
import {
  initialServiceCatalogForm,
  toServiceCatalogForm,
} from '../../../../entities/service-catalog/model/forms';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../../entities/service-catalog/model/types';
import { queryClient, queryKeys } from '../../../../shared/api/queryClient';
import {
  CatalogServiceModal,
  CatalogSuggestionProductModal,
} from '../product-catalog/ProductCatalogModals';
import { resolveProfitReportCatalogTarget } from '../../model/profit-report';

type ProfitReportCatalogModalHostProps = {
  row: ProfitMarginRow | null;
  catalogProducts: CatalogProduct[];
  services: ServiceCatalogItem[];
  canWrite: boolean;
  onClose: () => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

const invalidateCatalogQueries = async () => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.catalogProducts }),
    queryClient.invalidateQueries({ queryKey: queryKeys.services }),
  ]);
};

export const ProfitReportCatalogModalHost = ({
  row,
  catalogProducts,
  services,
  canWrite,
  onClose,
  onError,
  onSuccess,
}: ProfitReportCatalogModalHostProps) => {
  const { t } = useTranslation();
  const target = useMemo(
    () =>
      row
        ? resolveProfitReportCatalogTarget(row, catalogProducts, services)
        : null,
    [catalogProducts, row, services],
  );
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
    const product = target.product;
    return (
      <CatalogSuggestionProductModal
        product={product}
        readOnly={!canWrite}
        onClose={onClose}
        onSave={async (payload) => {
          try {
            await updateCatalogProduct(product.id, payload);
            await invalidateCatalogQueries();
            onSuccess?.(t('accounting.profit.catalogSaved'));
            onClose();
          } catch (error) {
            onError?.(
              error instanceof Error
                ? error.message
                : t('accounting.profit.loadError'),
            );
          }
        }}
        onRemove={async () => {
          if (
            !window.confirm(
              t('catalog.modals.confirmRemoveProduct', { name: product.name }),
            )
          ) {
            return;
          }
          try {
            await deleteCatalogProduct(product.id);
            await invalidateCatalogQueries();
            onSuccess?.(t('accounting.profit.catalogRemoved'));
            onClose();
          } catch (error) {
            onError?.(
              error instanceof Error
                ? error.message
                : t('accounting.profit.loadError'),
            );
          }
        }}
      />
    );
  }

  const isEditing =
    JSON.stringify(serviceForm) !== JSON.stringify(toServiceCatalogForm(target.service));

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
