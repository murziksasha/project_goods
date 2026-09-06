import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { Supplier } from '../../../../entities/supplier/model/types';
import type {
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../../entities/supplier-order/model/types';
import {
  supplierOrderStatuses,
  supplierPaymentStatuses,
  type SupplierOrdersDateField,
  type SupplierOrdersFilters,
} from '../../model/supplier-orders-workspace';
import { SavedFiltersPanel } from '../orders/workspace/SavedFiltersPanel';

type SavedFilterItem = {
  id: string;
  name: string;
  icon: string;
};

type SupplierOrdersFilterPanelProps = {
  isOpen: boolean;
  isStatusFilterOpen: boolean;
  isPaymentFilterOpen: boolean;
  canManageSavedFilters: boolean;
  draftFilters: SupplierOrdersFilters;
  savedFilters: SavedFilterItem[];
  suppliers: Supplier[];
  createdByOptions: string[];
  newFilterName: string;
  newFilterIcon: string;
  statusFilterRef: RefObject<HTMLDivElement | null>;
  paymentFilterRef: RefObject<HTMLDivElement | null>;
  setDraftFilters: Dispatch<SetStateAction<SupplierOrdersFilters>>;
  setIsStatusFilterOpen: Dispatch<SetStateAction<boolean>>;
  setIsPaymentFilterOpen: Dispatch<SetStateAction<boolean>>;
  setNewFilterName: Dispatch<SetStateAction<string>>;
  setNewFilterIcon: Dispatch<SetStateAction<string>>;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onSaveCurrentFilter: () => void;
  onApplySavedFilter: (filterId: string) => void;
  onRemoveSavedFilter: (filterId: string) => void;
};

export const SupplierOrdersFilterPanel = ({
  isOpen,
  isStatusFilterOpen,
  isPaymentFilterOpen,
  canManageSavedFilters,
  draftFilters,
  savedFilters,
  suppliers,
  createdByOptions,
  newFilterName,
  newFilterIcon,
  statusFilterRef,
  paymentFilterRef,
  setDraftFilters,
  setIsStatusFilterOpen,
  setIsPaymentFilterOpen,
  setNewFilterName,
  setNewFilterIcon,
  onApplyFilters,
  onResetFilters,
  onSaveCurrentFilter,
  onApplySavedFilter,
  onRemoveSavedFilter,
}: SupplierOrdersFilterPanelProps) => {
  const { t } = useTranslation();

  const toggleStatus = (status: SupplierOrderStatus) => {
    setDraftFilters((current) => ({
      ...current,
      selectedStatuses: current.selectedStatuses.includes(status)
        ? current.selectedStatuses.filter((item) => item !== status)
        : [...current.selectedStatuses, status],
    }));
  };

  const togglePayment = (status: SupplierPaymentStatus) => {
    setDraftFilters((current) => ({
      ...current,
      paymentStatuses: current.paymentStatuses.includes(status)
        ? current.paymentStatuses.filter((item) => item !== status)
        : [...current.paymentStatuses, status],
    }));
  };

  return (
    <section
      className={
        isOpen ? 'orders-filter-panel orders-filter-panel-open' : 'orders-filter-panel'
      }
      aria-hidden={!isOpen}
    >
      <SavedFiltersPanel
        canSave={canManageSavedFilters}
        items={savedFilters}
        newFilterIcon={newFilterIcon}
        newFilterName={newFilterName}
        saveDisabled={!canManageSavedFilters}
        saveTitle={
          canManageSavedFilters
            ? t('orders.filters.saveFilter')
            : t('orders.filters.saveFilterDenied')
        }
        onApply={onApplySavedFilter}
        onDelete={onRemoveSavedFilter}
        onIconChange={setNewFilterIcon}
        onNameChange={setNewFilterName}
        onSave={onSaveCurrentFilter}
      />

      <div className='orders-filter-grid'>
        <div
          className='orders-filter-field orders-filter-status-field'
          ref={statusFilterRef}
        >
          <span>{t('orders.supplier.filters.orderStatus')}</span>
          <button
            type='button'
            className='orders-filter-status-toggle'
            aria-expanded={isStatusFilterOpen}
            onClick={() => setIsStatusFilterOpen((current) => !current)}
          >
            {draftFilters.selectedStatuses.length > 0
              ? t('orders.supplier.toolbar.orderStatusesCount', {
                  count: draftFilters.selectedStatuses.length,
                })
              : t('orders.filters.all')}
          </button>
          {isStatusFilterOpen ? (
            <div className='orders-filter-status-menu'>
              <label className='orders-filter-status-all'>
                <input
                  type='checkbox'
                  checked={
                    draftFilters.selectedStatuses.length ===
                    supplierOrderStatuses.length
                  }
                  onChange={() =>
                    setDraftFilters((current) => ({
                      ...current,
                      selectedStatuses:
                        current.selectedStatuses.length ===
                        supplierOrderStatuses.length
                          ? []
                          : supplierOrderStatuses.map((item) => item.key),
                    }))
                  }
                />
                <strong>{t('orders.supplier.toolbar.selectAll')}</strong>
              </label>
              {supplierOrderStatuses.map((status) => (
                <label key={status.key}>
                  <input
                    type='checkbox'
                    checked={draftFilters.selectedStatuses.includes(status.key)}
                    onChange={() => toggleStatus(status.key)}
                  />
                  <span>{t(status.labelKey)}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className='orders-filter-field orders-filter-status-field'
          ref={paymentFilterRef}
        >
          <span>{t('orders.supplier.filters.paymentStatus')}</span>
          <button
            type='button'
            className='orders-filter-status-toggle'
            aria-expanded={isPaymentFilterOpen}
            onClick={() => setIsPaymentFilterOpen((current) => !current)}
          >
            {draftFilters.paymentStatuses.length > 0
              ? t('orders.supplier.toolbar.paymentStatusesCount', {
                  count: draftFilters.paymentStatuses.length,
                })
              : t('orders.filters.all')}
          </button>
          {isPaymentFilterOpen ? (
            <div className='orders-filter-status-menu'>
              <label className='orders-filter-status-all'>
                <input
                  type='checkbox'
                  checked={
                    draftFilters.paymentStatuses.length ===
                    supplierPaymentStatuses.length
                  }
                  onChange={() =>
                    setDraftFilters((current) => ({
                      ...current,
                      paymentStatuses:
                        current.paymentStatuses.length ===
                        supplierPaymentStatuses.length
                          ? []
                          : supplierPaymentStatuses.map((item) => item.key),
                    }))
                  }
                />
                <strong>{t('orders.supplier.toolbar.selectAll')}</strong>
              </label>
              {supplierPaymentStatuses.map((status) => (
                <label key={status.key}>
                  <input
                    type='checkbox'
                    checked={draftFilters.paymentStatuses.includes(status.key)}
                    onChange={() => togglePayment(status.key)}
                  />
                  <span>{t(status.labelKey)}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <label className='orders-filter-field'>
          <span>{t('orders.supplier.filters.orderNumber')}</span>
          <input
            type='text'
            value={draftFilters.orderNumber}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                orderNumber: event.target.value,
              }))
            }
            placeholder={t('orders.supplier.filters.orderNumberPlaceholder')}
          />
        </label>

        <label className='orders-filter-field'>
          <span>{t('orders.supplier.filters.product')}</span>
          <input
            type='text'
            value={draftFilters.product}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                product: event.target.value,
              }))
            }
            placeholder={t('orders.supplier.filters.productPlaceholder')}
          />
        </label>

        <label className='orders-filter-field'>
          <span>{t('orders.supplier.filters.supplier')}</span>
          <select
            value={draftFilters.supplierId}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                supplierId: event.target.value,
              }))
            }
          >
            <option value=''>{t('orders.filters.all')}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>

        <label className='orders-filter-field'>
          <span>{t('orders.supplier.filters.createdBy')}</span>
          <select
            value={draftFilters.createdBy}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                createdBy: event.target.value,
              }))
            }
          >
            <option value=''>{t('orders.filters.all')}</option>
            {createdByOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className='orders-filter-field'>
          <span>{t('orders.supplier.filters.dateField')}</span>
          <select
            value={draftFilters.dateField}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                dateField: event.target.value as SupplierOrdersDateField,
              }))
            }
          >
            <option value='delivery'>
              {t('orders.supplier.filters.dateFieldDelivery')}
            </option>
            <option value='created'>
              {t('orders.supplier.filters.dateFieldCreated')}
            </option>
          </select>
        </label>

        <label className='orders-filter-field'>
          <span>{t('orders.supplier.filters.dateFrom')}</span>
          <input
            type='date'
            value={draftFilters.dateFrom}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                dateFrom: event.target.value,
              }))
            }
          />
        </label>

        <label className='orders-filter-field'>
          <span>{t('orders.supplier.filters.dateTo')}</span>
          <input
            type='date'
            value={draftFilters.dateTo}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                dateTo: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <div className='orders-filter-actions'>
        <button
          type='button'
          className='toolbar-filter-button orders-filter-apply'
          onClick={onApplyFilters}
        >
          {t('orders.filters.apply')}
        </button>
        <button
          type='button'
          className='toolbar-filter-button'
          onClick={onResetFilters}
        >
          {t('orders.filters.clear')}
        </button>
      </div>
    </section>
  );
};
