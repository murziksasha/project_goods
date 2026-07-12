import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import {
  filterIconOptions,
  type OrderStatus,
  type OrdersFilters,
  type PaymentMethod,
  type RepairTypeFilter,
  type SavedOrdersFilter,
} from './orders-workspace-shared';

type StatusOption = {
  key: OrderStatus;
  labelKey: string;
};

type AssigneeOption = {
  id: string;
  label: string;
};

type OrdersWorkspaceFilterPanelProps = {
  isFilterPanelOpen: boolean;
  isStatusFilterOpen: boolean;
  isSaveFilterDrawerOpen: boolean;
  canManageSavedFilters: boolean;
  visibleSavedFilters: SavedOrdersFilter[];
  employeeSavedFilters: SavedOrdersFilter[];
  draftFilters: OrdersFilters;
  statusOptionsForActiveTab: StatusOption[];
  assigneeOptions: AssigneeOption[];
  warehouseOptions: string[];
  newFilterName: string;
  newFilterIcon: string;
  statusFilterRef: RefObject<HTMLDivElement | null>;
  setDraftFilters: Dispatch<SetStateAction<OrdersFilters>>;
  setIsStatusFilterOpen: Dispatch<SetStateAction<boolean>>;
  setIsSaveFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setNewFilterName: Dispatch<SetStateAction<string>>;
  setNewFilterIcon: Dispatch<SetStateAction<string>>;
  onToggleStatusFilter: (status: OrderStatus) => void;
  onToggleAllStatuses: () => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onSaveCurrentFilter: () => void;
  onApplySavedFilter: (savedFilter: SavedOrdersFilter) => void;
  onRemoveSavedFilter: (filterId: string) => void;
};

export const OrdersWorkspaceFilterPanel = ({
  isFilterPanelOpen,
  isStatusFilterOpen,
  isSaveFilterDrawerOpen,
  canManageSavedFilters,
  visibleSavedFilters,
  employeeSavedFilters,
  draftFilters,
  statusOptionsForActiveTab,
  assigneeOptions,
  warehouseOptions,
  newFilterName,
  newFilterIcon,
  statusFilterRef,
  setDraftFilters,
  setIsStatusFilterOpen,
  setIsSaveFilterDrawerOpen,
  setNewFilterName,
  setNewFilterIcon,
  onToggleStatusFilter,
  onToggleAllStatuses,
  onApplyFilters,
  onResetFilters,
  onSaveCurrentFilter,
  onApplySavedFilter,
  onRemoveSavedFilter,
}: OrdersWorkspaceFilterPanelProps) => {
  const { t } = useTranslation();

  return (
    <>
      <section
        className={
          isFilterPanelOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
        aria-hidden={!isFilterPanelOpen}
      >
        <div className="orders-filter-saved-row">
          <p>{t('orders.filters.savedLabel')}</p>
          <div className="orders-filter-saved-list">
            {visibleSavedFilters.length > 0 ? (
              visibleSavedFilters.map((savedFilter) => (
                <div
                  key={savedFilter.id}
                  className="orders-filter-saved-item"
                >
                  <button
                    type="button"
                    className="orders-filter-saved-button"
                    onClick={() => onApplySavedFilter(savedFilter)}
                    title={savedFilter.name}
                  >
                    <span>{savedFilter.icon}</span>
                    <span>{savedFilter.name}</span>
                  </button>
                  <button
                    type="button"
                    className="orders-filter-delete-button"
                    aria-label={t('orders.filters.deleteFilter', {
                      name: savedFilter.name,
                    })}
                    onClick={() => onRemoveSavedFilter(savedFilter.id)}
                  >
                    🗑️
                  </button>
                </div>
              ))
            ) : (
              <small>{t('orders.filters.noSaved')}</small>
            )}
          </div>
          <button
            type="button"
            className="toolbar-filter-button"
            onClick={() => setIsSaveFilterDrawerOpen(true)}
            disabled={!canManageSavedFilters}
            title={
              canManageSavedFilters
                ? t('orders.filters.saveFilter')
                : t('orders.filters.saveFilterDenied')
            }
          >
            {t('orders.filters.saveFilter')}
          </button>
        </div>

        <div className="orders-filter-grid">
          <div
            className="orders-filter-field orders-filter-status-field"
            ref={statusFilterRef}
          >
            <span>{t('orders.filters.status')}</span>
            <button
              type="button"
              className="orders-filter-status-toggle"
              aria-expanded={isStatusFilterOpen}
              onClick={() => setIsStatusFilterOpen((current) => !current)}
            >
              {draftFilters.statuses.length > 0
                ? t('orders.filters.selectedCount', {
                    count: draftFilters.statuses.length,
                  })
                : t('orders.filters.all')}
            </button>
            {isStatusFilterOpen ? (
              <div className="orders-filter-status-menu">
                <label className="orders-filter-status-all">
                  <input
                    type="checkbox"
                    checked={
                      draftFilters.statuses.length ===
                      statusOptionsForActiveTab.length
                    }
                    onChange={onToggleAllStatuses}
                  />
                  <strong>{t('orders.filters.all')}</strong>
                </label>
                {statusOptionsForActiveTab.map((statusOption) => (
                  <label key={statusOption.key}>
                    <input
                      type="checkbox"
                      checked={draftFilters.statuses.includes(statusOption.key)}
                      onChange={() => onToggleStatusFilter(statusOption.key)}
                    />
                    <span>{t(statusOption.labelKey)}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <label className="orders-filter-field">
            <span>{t('orders.filters.orderNumber')}</span>
            <input
              type="text"
              value={draftFilters.orderNumber}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  orderNumber: event.target.value,
                }))
              }
              placeholder={t('orders.filters.orderNumberPlaceholder')}
            />
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.client')}</span>
            <input
              type="text"
              value={draftFilters.client}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  client: event.target.value,
                }))
              }
              placeholder={t('orders.filters.clientPlaceholder')}
            />
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.assignee')}</span>
            <select
              value={draftFilters.assigneeId}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  assigneeId: event.target.value,
                }))
              }
            >
              <option value="">{t('orders.filters.all')}</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.label}
                </option>
              ))}
            </select>
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.warehouse')}</span>
            <select
              value={draftFilters.warehouse}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  warehouse: event.target.value,
                }))
              }
            >
              <option value="">{t('orders.filters.all')}</option>
              {warehouseOptions.map((warehouse) => (
                <option key={warehouse} value={warehouse}>
                  {warehouse}
                </option>
              ))}
            </select>
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.repairType')}</span>
            <select
              value={draftFilters.repairType}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  repairType: event.target.value as RepairTypeFilter,
                }))
              }
            >
              <option value="all">{t('orders.filters.all')}</option>
              <option value="paid">{t('orders.filters.repairTypePaid')}</option>
              <option value="warranty">
                {t('orders.filters.repairTypeWarranty')}
              </option>
            </select>
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.dateFrom')}</span>
            <input
              type="date"
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.dateTo')}</span>
            <input
              type="date"
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.paymentMethod')}</span>
            <select
              value={draftFilters.paymentMethod}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  paymentMethod: event.target.value as '' | PaymentMethod,
                }))
              }
            >
              <option value="">{t('orders.filters.all')}</option>
              <option value="cash">{t('orders.filters.paymentCash')}</option>
              <option value="non-cash">
                {t('orders.filters.paymentNonCash')}
              </option>
            </select>
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.product')}</span>
            <input
              type="text"
              value={draftFilters.product}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  product: event.target.value,
                }))
              }
              placeholder={t('orders.filters.productPlaceholder')}
            />
          </label>

          <label className="orders-filter-field">
            <span>{t('orders.filters.service')}</span>
            <input
              type="text"
              value={draftFilters.service}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  service: event.target.value,
                }))
              }
              placeholder={t('orders.filters.servicePlaceholder')}
            />
          </label>
        </div>

        <div className="orders-filter-actions">
          <button
            type="button"
            className="toolbar-filter-button orders-filter-apply"
            onClick={onApplyFilters}
          >
            {t('orders.filters.apply')}
          </button>
          <button
            type="button"
            className="toolbar-filter-button"
            onClick={onResetFilters}
          >
            {t('orders.filters.clear')}
          </button>
        </div>
      </section>

      {isSaveFilterDrawerOpen ? (
        <div
          className="orders-filter-drawer-backdrop"
          onClick={() => setIsSaveFilterDrawerOpen(false)}
        >
          <aside
            className="orders-filter-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h3>{t('orders.filters.drawer.title')}</h3>
              <button
                type="button"
                aria-label={t('orders.filters.drawer.close')}
                onClick={() => setIsSaveFilterDrawerOpen(false)}
              >
                x
              </button>
            </header>
            <label className="orders-filter-field">
              <span>{t('orders.filters.drawer.filterName')}</span>
              <input
                type="text"
                value={newFilterName}
                onChange={(event) => setNewFilterName(event.target.value)}
                placeholder={t('orders.filters.drawer.filterNamePlaceholder')}
              />
            </label>
            <div className="orders-filter-icons">
              <span>{t('orders.filters.drawer.chooseIcon')}</span>
              <div className="orders-filter-icons-grid">
                {filterIconOptions.map((icon, index) => (
                  <button
                    key={`${icon}-${index}`}
                    type="button"
                    className={
                      icon === newFilterIcon
                        ? 'orders-filter-icon-button orders-filter-icon-button-active'
                        : 'orders-filter-icon-button'
                    }
                    onClick={() => setNewFilterIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="orders-filter-drawer-list">
              <span>{t('orders.filters.drawer.yourSaved')}</span>
              {employeeSavedFilters.length > 0 ? (
                employeeSavedFilters.map((savedFilter) => (
                  <div
                    key={savedFilter.id}
                    className="orders-filter-drawer-item"
                  >
                    <button
                      type="button"
                      onClick={() => onApplySavedFilter(savedFilter)}
                    >
                      {`${savedFilter.icon} ${savedFilter.name}`}
                    </button>
                    <button
                      type="button"
                      className="orders-filter-delete-button"
                      onClick={() => onRemoveSavedFilter(savedFilter.id)}
                      aria-label={t('orders.filters.deleteFilter', {
                        name: savedFilter.name,
                      })}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              ) : (
                <small>{t('orders.filters.drawer.noFiltersYet')}</small>
              )}
            </div>
            <footer>
              <button
                type="button"
                className="toolbar-filter-button orders-filter-apply"
                onClick={onSaveCurrentFilter}
                disabled={!canManageSavedFilters}
              >
                {t('orders.filters.drawer.save')}
              </button>
              <button
                type="button"
                className="toolbar-filter-button"
                onClick={() => setIsSaveFilterDrawerOpen(false)}
              >
                {t('orders.filters.drawer.cancel')}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
};