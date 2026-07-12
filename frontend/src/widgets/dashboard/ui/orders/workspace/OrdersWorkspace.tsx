import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../../shared/i18n/config';
import { hasEmployeePermission } from '../../../../../entities/employee/model/permissions';
import type { Sale } from '../../../../../entities/sale/model/types';
import { isRepairOrder } from '../../../../../entities/sale/lib/sale-kind';
import { formatCurrency } from '../../../../../shared/lib/format';
import { parseMoney } from '../../../../../shared/lib/decimal';
import {
  getSaleClientPhones,
  saleMatchesPhoneQuery,
} from '../../../../../entities/client/lib/phone-match';
import type { ClientStatus } from '../../../../../entities/client/model/types';
import {
  getClientStatusClass,
  getClientStatusColor,
  getClientStatusLabelKey,
  getEffectiveClientStatusLogic,
} from '../../../../../entities/client/model/constants';
import { normalizePhone } from '../../../../../shared/lib/phoneFormatter';
import { getCashboxes } from '../../../../../entities/finance/api/financeApi';
import {
  acceptSalePayment as acceptSalePaymentRequest,
  refundSalePayment as refundSalePaymentRequest,
  returnSale as returnSaleRequest,
  returnSaleLineItemToStock,
  updateSaleFavorite,
  updateSaleWorkspace,
} from '../../../../../entities/sale/api/saleApi';
import {
  invalidateSupplierOrderQueries,
  useSupplierOrdersQuery,
} from '../../../../../entities/supplier-order/api/supplierOrderApi';
import type { Cashbox } from '../../../../../entities/finance/model/types';
import { OrdersActiveFilterChips } from './OrdersActiveFilterChips';
import { OrdersWorkspaceFilterPanel } from './OrdersWorkspaceFilterPanel';
import { OrdersWorkspaceListHeader } from './OrdersWorkspaceListHeader';
import { OrdersWorkspaceModals } from './OrdersWorkspaceModals';
import { OrdersWorkspaceTableSection } from './OrdersWorkspaceTableSection';
import { TruncatedTextTooltip } from '../../../../../shared/ui/TruncatedTextTooltip';

import { OrderDetailCard } from '../order-detail/OrderDetailCard';
import { OrderDetailCardSkeleton } from '../order-detail/OrderDetailCardSkeleton';
import { getOrderLink } from '../create-order/create-order-card-shared';
import {
  canRemoveLineItemAfterPayment,
  patchLineItemsById,
  removeLineItemsById,
} from '../../../model/line-item-ops';
import { createRuntimeId } from '../../../../../shared/lib/runtime-id';
import { getClientStatsMap } from '../../../model/clients-workspace';
import {
  getSaleClientDisplayName,
  getSaleClientSearchValues,
  isRapidSaleClientLinkDisabled,
} from '../../../model/sale-client-display';
import {
  activeOrdersFiltersStorageKey,
  availableColumnsByTab,
  buildOrderNumber,
  canRefundFromStatus,
  emptyOrdersFilters,
  filterIconOptions,
  formatReadyDate,

  getCreatedTime,
  getDefaultLineItems,
  getDiscount,
  getIsoDatePart,
  getLatestDepositPaymentMethod,
  getLineItemRefundableAmount,
  getLineItemsTotal,

  getOrderTotal,

  getPrimaryDeviceName,
  getPrimaryDeviceSerial,
  getPrimaryItemCellContent,
  getRepairCompletionDate,
  getRemainingPayment,
  getSalePaidAmount,
  buildAddedItemTimelineMessage,
  buildBoundSerialsTimelineMessage,
  buildChangedStatusTimelineMessage,
  buildRemovedProductTimelineMessage,
  buildRemovedServiceTimelineMessage,
  buildUpdatedMainInfoTimelineMessage,
  buildUpdatedUserNoteTimelineMessage,
  getStatusLabel,

  getWarehouseLabel,
  hasNonCashPayment,
  hasSaleReturnObligations,
  isOrderEditableStatus,
  isClosingStatus,

  isIsoDateWithinRange,
  isPlainLeftClick,
  isRepairDevicePlaceholderLineItem,
  isRepairStatusChangeLockedByStock,
  isSalePaymentStatus,
  isUrgentRepairOrder,
  lockedColumnsByTab,
  computeOrderStatusMenuPosition,
  normalizeOrderStatus,

  type OrderStatusMenuPosition,
  ordersColumnsStorageKey,
  readActiveOrderFilters,
  readSavedOrderFilters,
  readVisibleColumns,
  repairStatuses,
  saleStatuses,
  savedOrdersFiltersStorageKey,
  shouldCaptureReceivedBy,
  stockLockedRepairStatuses,
  getStockLockedRepairStatusMessage,
  type OrderLineItem,
  type OrderPrintRequest,
  type OrderStatus,
  type OrdersColumnKey,
  type OrdersColumnVisibility,
  type OrdersFilters,
  type OrdersTab,
  type OrdersWorkspaceProps,
  type PaymentAction,
  type PaymentEntry,
  type PaymentMethod,
  type PaymentTargetStatus,
  type RepairStatus,
  type SavedOrdersFilter,
  type TimelineEntry,
} from './orders-workspace-shared';

import { PhoneNumber } from '../../shared/PhoneNumber';

const isSaleResponse = (value: unknown): value is Sale => {
  if (typeof value !== 'object' || value === null) return false;

  const sale = value as Partial<Sale>;
  return (
    typeof sale.id === 'string' &&
    typeof sale.saleDate === 'string' &&
    typeof sale.kind === 'string' &&
    typeof sale.status === 'string' &&
    typeof sale.client === 'object' &&
    sale.client !== null &&
    Array.isArray(sale.timeline) &&
    Array.isArray(sale.paymentHistory)
  );
};

export const OrdersWorkspace = ({
  sales,
  employees,
  isLoading,
  activeTab,
  visibleTabs,
  searchValue,
  currentEmployee,
  canCreateOrders,
  onActiveTabChange,
  onSearchChange,
  onCreateOrder,
  createOrderHref,
  getCreateOrderHref,
  onSaleUpdate,
  onError,
  onSuccess,
  externalSelectedSaleId = null,
  onExternalSaleOpenHandled,
  onSelectedSaleIdChange,
  onOpenClientCard,
  products,
  clientDevices,
  catalogProducts,
  printForms,
  printCompanySettings,
  onCreateClientDevice,
  onUpdateClientDevice,
  onDeleteClientDevice,
  onUpdateProductModel,
  pendingPaymentSale = null,
  onPendingPaymentSaleHandled,
}: OrdersWorkspaceProps) => {
  const { t } = useTranslation();
  const currentEmployeeName =
    currentEmployee?.name ?? t('orders.messages.errors.unknownEmployee');
  const canAcceptFinanceDeposit = hasEmployeePermission(
    currentEmployee,
    'finance.transactions.deposit',
  );
  const canCreateFinanceWithdraw = hasEmployeePermission(
    currentEmployee,
    'finance.transactions.withdraw',
  );
  const canChatInOrders = hasEmployeePermission(
    currentEmployee,
    'orders.chat',
  );
  const canViewSupplierOrders =
    hasEmployeePermission(currentEmployee, 'supplierOrders.view') ||
    hasEmployeePermission(currentEmployee, 'supplierOrders.manage');
  const [visibleColumns, setVisibleColumns] =
    useState<OrdersColumnVisibility>(readVisibleColumns);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(
    null,
  );
  const orderDetailAnchorRef = useRef<HTMLDivElement>(null);
  const [printRequest, setPrintRequest] =
    useState<OrderPrintRequest | null>(null);
  const [openStatusSaleId, setOpenStatusSaleId] = useState<
    string | null
  >(null);
  const [statusMenuPosition, setStatusMenuPosition] =
    useState<OrderStatusMenuPosition | null>(null);
  const statusMenuOptionsRef = useRef<HTMLDivElement>(null);
  const ordersTableWrapRef = useRef<HTMLDivElement>(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const [refundSale, setRefundSale] = useState<Sale | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [fullReturnSale, setFullReturnSale] = useState<Sale | null>(
    null,
  );
  const [returnLineItem, setReturnLineItem] =
    useState<OrderLineItem | null>(null);
  const [paymentTargetStatus, setPaymentTargetStatus] =
    useState<PaymentTargetStatus>('issued');
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [selectedCashboxId, setSelectedCashboxId] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedRefundCashboxId, setSelectedRefundCashboxId] =
    useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [returnRefundAmount, setReturnRefundAmount] = useState('');
  const [returnWarehouse, setReturnWarehouse] =
    useState(() => i18n.t('orders.columns.serviceCenter'));
  const [isPaymentModalLoading, setIsPaymentModalLoading] =
    useState(false);
  const [isPaymentSaving, setIsPaymentSaving] = useState(false);
  const [isRefundModalLoading, setIsRefundModalLoading] =
    useState(false);
  const [isRefundSaving, setIsRefundSaving] = useState(false);
  const [isReturnModalLoading, setIsReturnModalLoading] =
    useState(false);
  const [isReturnSaving, setIsReturnSaving] = useState(false);
  const [isFullReturnModalLoading, setIsFullReturnModalLoading] =
    useState(false);
  const [isFullReturnSaving, setIsFullReturnSaving] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isSaveFilterDrawerOpen, setIsSaveFilterDrawerOpen] =
    useState(false);
  const [savedFilters, setSavedFilters] = useState<
    SavedOrdersFilter[]
  >(readSavedOrderFilters);
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterIcon, setNewFilterIcon] = useState(
    filterIconOptions[0],
  );
  const [storedActiveFilters, setStoredActiveFilters] = useState<
    Record<OrdersTab, OrdersFilters>
  >(readActiveOrderFilters);
  const [draftFilters, setDraftFilters] = useState<OrdersFilters>(
    () => readActiveOrderFilters()[activeTab],
  );
  const [appliedFilters, setAppliedFilters] = useState<OrdersFilters>(
    () => readActiveOrderFilters()[activeTab],
  );
  const [pageByTab, setPageByTab] = useState<
    Record<OrdersTab, number>
  >({
    orders: 1,
    sales: 1,
    supplierOrders: 1,
    supplierInformation: 1,
  });
  const [pageSizeByTab, setPageSizeByTab] = useState<
    Record<OrdersTab, number>
  >({
    orders: 30,
    sales: 30,
    supplierOrders: 30,
    supplierInformation: 30,
  });
  const [warningMessage, setWarningMessage] = useState<string | null>(
    null,
  );
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);
  const statusFilterRef = useRef<HTMLDivElement | null>(null);
  const canManageSavedFilters = Boolean(currentEmployee?.id);
  const employeeSavedFilters = useMemo(() => {
    if (!currentEmployee?.id) return [];
    return savedFilters
      .filter((item) => item.employeeId === currentEmployee.id)
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      );
  }, [currentEmployee?.id, savedFilters]);
  const visibleSavedFilters = useMemo(
    () =>
      employeeSavedFilters.filter((item) => item.tab === activeTab),
    [activeTab, employeeSavedFilters],
  );
  const visibleColumnKeys = visibleColumns[activeTab];
  const tableMinWidth = Math.max(720, visibleColumnKeys.length * 104);
  const tabSales = useMemo(
    () =>
      sales.filter((sale) =>
        activeTab === 'orders'
          ? isRepairOrder(sale)
          : !isRepairOrder(sale),
      ),
    [activeTab, sales],
  );
  const clientStatsMap = useMemo(() => getClientStatsMap(sales), [sales]);
  const statusOptionsForActiveTab = useMemo(
    () => (activeTab === 'orders' ? repairStatuses : saleStatuses),
    [activeTab],
  );
  const statusKeysForActiveTab = useMemo(
    () =>
      new Set(statusOptionsForActiveTab.map((option) => option.key)),
    [statusOptionsForActiveTab],
  );
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    tabSales.forEach((sale) => {
      if (sale.master) {
        map.set(
          sale.master.id,
          t('orders.toolbar.assignee.master', { name: sale.master.name }),
        );
      }
      if (sale.manager) {
        map.set(
          sale.manager.id,
          t('orders.toolbar.assignee.manager', { name: sale.manager.name }),
        );
      }
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((first, second) =>
        first.label.localeCompare(second.label),
      );
  }, [tabSales, t]);
  const warehouseOptions = useMemo(() => {
    const values = new Set(
      tabSales.map((sale) => getWarehouseLabel(sale)),
    );
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [tabSales]);
  const activeFiltersCount = useMemo(
    () =>
      appliedFilters.statuses.length +
      (appliedFilters.orderNumber.trim() ? 1 : 0) +
      (appliedFilters.client.trim() ? 1 : 0) +
      (appliedFilters.assigneeId ? 1 : 0) +
      (appliedFilters.warehouse ? 1 : 0) +
      (appliedFilters.repairType !== 'all' ? 1 : 0) +
      (appliedFilters.paymentMethod ? 1 : 0) +
      (appliedFilters.dateFrom ? 1 : 0) +
      (appliedFilters.dateTo ? 1 : 0) +
      (appliedFilters.product.trim() ? 1 : 0) +
      (appliedFilters.service.trim() ? 1 : 0) +
      (appliedFilters.favoritesOnly ? 1 : 0),
    [appliedFilters],
  );

  const filteredOrders = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const queryPhone = normalizePhone(searchValue);
    const sortedTabSales = [...tabSales].sort(
      (firstSale, secondSale) =>
        getCreatedTime(secondSale) - getCreatedTime(firstSale),
    );
    const orderNumberValue = appliedFilters.orderNumber
      .trim()
      .toLowerCase();
    const clientValue = appliedFilters.client.trim().toLowerCase();
    const clientPhoneValue = normalizePhone(appliedFilters.client);
    const productValue = appliedFilters.product.trim().toLowerCase();
    const serviceValue = appliedFilters.service.trim().toLowerCase();

    return sortedTabSales.filter((sale) => {
      const orderNumber = buildOrderNumber(sale);
      const status = normalizeOrderStatus(sale.status);
      const lineItems = sale.lineItems?.length
        ? sale.lineItems
        : getDefaultLineItems(sale);
      const hasWarrantyService = lineItems.some(
        (item) => item.kind === 'service' && item.warrantyPeriod > 0,
      );
      const salePhones = getSaleClientPhones(sale);
      const clientSearchValues = getSaleClientSearchValues(sale, t);
      const searchValues =
        activeTab === 'orders'
          ? [getPrimaryDeviceName(sale), ...clientSearchValues, ...salePhones]
          : [
              ...clientSearchValues,
              ...salePhones,
              sale.manager?.name ?? '',
              sale.issuedBy?.name ?? '',
            ];
      const matchesPhoneQuery =
        Boolean(queryPhone) &&
        salePhones.some((phone) => normalizePhone(phone).includes(queryPhone));
      const matchesClientPhoneFilter =
        Boolean(clientPhoneValue) &&
        salePhones.some((phone) =>
          normalizePhone(phone).includes(clientPhoneValue),
        );
      const matchesClientTextFilter = saleMatchesPhoneQuery(sale, appliedFilters.client);

      if (
        appliedFilters.favoritesOnly &&
        sale.isFavorite !== true
      ) {
        return false;
      }
      if (
        query &&
        !(
          String(orderNumber).includes(query) ||
          matchesPhoneQuery ||
          searchValues.some((value) =>
            value.toLowerCase().includes(query),
          )
        )
      ) {
        return false;
      }
      if (
        orderNumberValue &&
        !String(orderNumber).toLowerCase().includes(orderNumberValue)
      ) {
        return false;
      }
      if (
        clientValue &&
        !(
          [...getSaleClientSearchValues(sale, t), String(orderNumber)].some((value) =>
            value.toLowerCase().includes(clientValue),
          ) ||
          matchesClientPhoneFilter ||
          matchesClientTextFilter
        )
      ) {
        return false;
      }
      if (
        appliedFilters.statuses.length > 0 &&
        !appliedFilters.statuses.includes(status)
      ) {
        return false;
      }
      if (
        appliedFilters.assigneeId &&
        sale.master?.id !== appliedFilters.assigneeId &&
        sale.manager?.id !== appliedFilters.assigneeId
      ) {
        return false;
      }
      if (
        appliedFilters.warehouse &&
        getWarehouseLabel(sale) !== appliedFilters.warehouse
      ) {
        return false;
      }
      if (appliedFilters.repairType === 'warranty') {
        if (!hasWarrantyService) return false;
      }
      if (appliedFilters.repairType === 'paid') {
        if (hasWarrantyService) return false;
      }
      if (
        appliedFilters.paymentMethod &&
        getLatestDepositPaymentMethod(sale) !==
          appliedFilters.paymentMethod
      ) {
        return false;
      }
      if (
        !isIsoDateWithinRange(
          getIsoDatePart(sale.saleDate),
          appliedFilters.dateFrom,
          appliedFilters.dateTo,
        )
      ) {
        return false;
      }
      if (
        productValue &&
        ![
          getPrimaryDeviceName(sale),
          ...lineItems
            .filter((item) => item.kind === 'product')
            .map((item) => item.name),
        ].some((value) => value.toLowerCase().includes(productValue))
      ) {
        return false;
      }
      if (
        serviceValue &&
        !lineItems
          .filter((item) => item.kind === 'service')
          .some((item) =>
            item.name.toLowerCase().includes(serviceValue),
          )
      ) {
        return false;
      }
      return true;
    });
  }, [activeTab, appliedFilters, searchValue, tabSales]);

  const canManageOrderFavorite = (sale: Sale) =>
    sale.kind === 'sale'
      ? hasEmployeePermission(currentEmployee, 'sales.manage')
      : hasEmployeePermission(currentEmployee, 'orders.manage');

  const toggleFavoritesOnly = () => {
    const nextFilters = {
      ...appliedFilters,
      favoritesOnly: !appliedFilters.favoritesOnly,
    };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setStoredActiveFilters((current) => ({
      ...current,
      [activeTab]: nextFilters,
    }));
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
  };

  const toggleOrderFavorite = async (sale: Sale) => {
    if (!canManageOrderFavorite(sale)) {
      onError(
        sale.kind === 'sale'
          ? t('orders.messages.errors.noManageSalesPermission')
          : t('orders.messages.errors.noManageOrdersPermission'),
      );
      return;
    }

    const nextIsFavorite = !sale.isFavorite;
    onSaleUpdate({ ...sale, isFavorite: nextIsFavorite });
    try {
      onSaleUpdate(
        await updateSaleFavorite(sale.id, {
          isFavorite: nextIsFavorite,
        }),
      );
    } catch (error) {
      onSaleUpdate(sale);
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedUpdateStar'),
      );
    }
  };

  const currentPage = pageByTab[activeTab];
  const currentPageSize = pageSizeByTab[activeTab];
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * currentPageSize;
    return filteredOrders.slice(start, start + currentPageSize);
  }, [currentPage, currentPageSize, filteredOrders]);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId],
  );
  const shouldLoadSupplierOrders =
    canViewSupplierOrders && Boolean(selectedSale);
  const supplierOrdersQuery = useSupplierOrdersQuery(shouldLoadSupplierOrders);
  const supplierOrders = supplierOrdersQuery.data ?? [];

  useEffect(() => {
    if (!supplierOrdersQuery.error) return;
    onError(
      supplierOrdersQuery.error instanceof Error
        ? supplierOrdersQuery.error.message
        : t('orders.messages.errors.failedLoadSupplierOrders'),
    );
  }, [onError, supplierOrdersQuery.error, t]);

  const refreshSupplierOrders = useCallback(async () => {
    await invalidateSupplierOrderQueries();
  }, []);

  useEffect(() => {
    const sanitizeFilters = (current: OrdersFilters) => {
      const nextStatuses = current.statuses.filter((status) =>
        statusKeysForActiveTab.has(status),
      );
      if (nextStatuses.length === current.statuses.length) {
        return current;
      }
      return { ...current, statuses: nextStatuses };
    };
    setDraftFilters((current) => sanitizeFilters(current));
    setAppliedFilters((current) => sanitizeFilters(current));
  }, [statusKeysForActiveTab]);

  useEffect(() => {
    setDraftFilters(
      storedActiveFilters[activeTab] ?? emptyOrdersFilters,
    );
    setAppliedFilters(
      storedActiveFilters[activeTab] ?? emptyOrdersFilters,
    );
  }, [activeTab, storedActiveFilters]);

  useEffect(() => {
    if (activeTab !== 'supplierOrders') return;
    setIsFilterPanelOpen(false);
    setIsStatusFilterOpen(false);
  }, [activeTab]);

  useEffect(() => {
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
  }, [activeTab, searchValue]);

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredOrders.length / currentPageSize),
    );

    if (currentPage > pageCount) {
      setPageByTab((current) => ({
        ...current,
        [activeTab]: pageCount,
      }));
    }
  }, [
    activeTab,
    currentPage,
    currentPageSize,
    filteredOrders.length,
  ]);

  const toggleStatusFilter = (status: OrderStatus) => {
    setDraftFilters((current) => {
      const hasStatus = current.statuses.includes(status);
      return {
        ...current,
        statuses: hasStatus
          ? current.statuses.filter((key) => key !== status)
          : [...current.statuses, status],
      };
    });
  };
  const toggleAllStatuses = () => {
    setDraftFilters((current) => {
      const isAllSelected =
        current.statuses.length === statusOptionsForActiveTab.length;
      return {
        ...current,
        statuses: isAllSelected
          ? []
          : statusOptionsForActiveTab.map((item) => item.key),
      };
    });
  };
  const toggleFilterPanel = () => {
    setIsFilterPanelOpen((current) => !current);
  };

  const applyFilters = () => {
    const nextFilters = {
      ...draftFilters,
      orderNumber: draftFilters.orderNumber.trim(),
      client: draftFilters.client.trim(),
      product: draftFilters.product.trim(),
      service: draftFilters.service.trim(),
    };
    setAppliedFilters(nextFilters);
    setStoredActiveFilters((current) => ({
      ...current,
      [activeTab]: nextFilters,
    }));
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
    setIsStatusFilterOpen(false);
    if (isFilterPanelOpen) {
      toggleFilterPanel();
    }
  };

  const resetFilters = () => {
    setDraftFilters(emptyOrdersFilters);
    setAppliedFilters(emptyOrdersFilters);
    setStoredActiveFilters((current) => ({
      ...current,
      [activeTab]: emptyOrdersFilters,
    }));
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
    setIsStatusFilterOpen(false);
  };

  const applyFiltersPatch = (nextFilters: OrdersFilters) => {
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setStoredActiveFilters((current) => ({
      ...current,
      [activeTab]: nextFilters,
    }));
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
  };

  const assigneeLabelById = useMemo(
    () => new Map(assigneeOptions.map((item) => [item.id, item.label])),
    [assigneeOptions],
  );
  const saveCurrentFilter = () => {
    if (!currentEmployee?.id) {
      onError(t('orders.messages.errors.employeeRequiredForFilters'));
      return;
    }
    const name = newFilterName.trim();
    if (!name) {
      onError(t('orders.messages.errors.enterFilterName'));
      return;
    }
    const nextFilter: SavedOrdersFilter = {
      id: createRuntimeId(),
      employeeId: currentEmployee.id,
      name,
      icon: newFilterIcon,
      tab: activeTab,
      filters: {
        ...draftFilters,
        orderNumber: draftFilters.orderNumber.trim(),
        client: draftFilters.client.trim(),
        product: draftFilters.product.trim(),
        service: draftFilters.service.trim(),
      },
      createdAt: new Date().toISOString(),
    };
    setSavedFilters((current) => [nextFilter, ...current]);
    setIsSaveFilterDrawerOpen(false);
    setNewFilterName('');
    setNewFilterIcon(filterIconOptions[0]);
    onSuccess(t('orders.messages.success.filterSaved'));
  };
  const applySavedFilter = (savedFilter: SavedOrdersFilter) => {
    onActiveTabChange(savedFilter.tab);
    setDraftFilters(savedFilter.filters);
    setAppliedFilters(savedFilter.filters);
    setStoredActiveFilters((current) => ({
      ...current,
      [savedFilter.tab]: savedFilter.filters,
    }));
    setIsFilterPanelOpen(true);
    setIsStatusFilterOpen(false);
  };
  const removeSavedFilter = (filterId: string) => {
    setSavedFilters((current) =>
      current.filter((item) => item.id !== filterId),
    );
  };

  useEffect(() => {
    window.localStorage.setItem(
      savedOrdersFiltersStorageKey,
      JSON.stringify(savedFilters),
    );
  }, [savedFilters]);

  useEffect(() => {
    window.localStorage.setItem(
      activeOrdersFiltersStorageKey,
      JSON.stringify(storedActiveFilters),
    );
  }, [storedActiveFilters]);

  useEffect(() => {
    if (!isFilterPanelOpen && !isSaveFilterDrawerOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isSaveFilterDrawerOpen) {
          setIsSaveFilterDrawerOpen(false);
          return;
        }
        if (isStatusFilterOpen) {
          setIsStatusFilterOpen(false);
          return;
        }
        setIsFilterPanelOpen(false);
      }
    };

    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isFilterPanelOpen, isSaveFilterDrawerOpen, isStatusFilterOpen]);

  useEffect(() => {
    if (!isStatusFilterOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        statusFilterRef.current &&
        !statusFilterRef.current.contains(event.target as Node)
      ) {
        setIsStatusFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [isStatusFilterOpen]);

  useEffect(() => {
    if (!isFilterPanelOpen) {
      setIsStatusFilterOpen(false);
    }
  }, [isFilterPanelOpen]);

  useEffect(() => {
    window.localStorage.setItem(
      ordersColumnsStorageKey,
      JSON.stringify(visibleColumns),
    );
  }, [visibleColumns]);

  useEffect(() => {
    if (!isColumnsMenuOpen) return;

    const closeMenuOnOutsideClick = (event: MouseEvent) => {
      if (
        columnsMenuRef.current &&
        !columnsMenuRef.current.contains(event.target as Node)
      ) {
        setIsColumnsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeMenuOnOutsideClick);

    return () => {
      document.removeEventListener(
        'mousedown',
        closeMenuOnOutsideClick,
      );
    };
  }, [isColumnsMenuOpen]);

  useEffect(() => {
    if (!openStatusSaleId) return;

    const closeStatusDropdownOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('.order-status-menu') ||
        target?.closest('.order-status-options-portal')
      )
        return;
      setOpenStatusSaleId(null);
    };

    document.addEventListener(
      'mousedown',
      closeStatusDropdownOnOutsideClick,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        closeStatusDropdownOnOutsideClick,
      );
    };
  }, [openStatusSaleId]);

  useEffect(() => {
    if (!openStatusSaleId) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const tableWrap = ordersTableWrapRef.current;
    const previousTableWrapOverflow = tableWrap?.style.overflow ?? '';

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (tableWrap) {
      tableWrap.style.overflow = 'hidden';
    }

    const preventBackgroundScroll = (event: WheelEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.order-status-options-portal')) return;
      event.preventDefault();
    };

    document.addEventListener('wheel', preventBackgroundScroll, {
      passive: false,
    });
    document.addEventListener('touchmove', preventBackgroundScroll, {
      passive: false,
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      if (tableWrap) {
        tableWrap.style.overflow = previousTableWrapOverflow;
      }
      document.removeEventListener('wheel', preventBackgroundScroll);
      document.removeEventListener('touchmove', preventBackgroundScroll);
    };
  }, [openStatusSaleId]);

  useEffect(() => {
    if (!openStatusSaleId) {
      setStatusMenuPosition(null);
      return;
    }

    const syncStatusMenuPosition = () => {
      const trigger = document.querySelector<HTMLElement>(
        `[data-status-trigger-id="${openStatusSaleId}"]`,
      );
      if (!trigger) {
        setStatusMenuPosition(null);
        return;
      }

      setStatusMenuPosition(
        computeOrderStatusMenuPosition(trigger.getBoundingClientRect()),
      );
    };

    syncStatusMenuPosition();

    const handleResize = () => {
      setOpenStatusSaleId(null);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [activeTab, openStatusSaleId]);

  const getLineItems = (sale: Sale) => {
    const sourceItems = Array.isArray(sale.lineItems)
      ? sale.lineItems
      : getDefaultLineItems(sale);
    return sourceItems.filter(
      (item) => !isRepairDevicePlaceholderLineItem(sale, item),
    );
  };

  const getPaidAmount = getSalePaidAmount;

  const openPrintDialog = (
    sale: Sale,
    lineItems = getLineItems(sale),
    paidAmount = getPaidAmount(sale),
  ) => {
    setPrintRequest({
      sale,
      lineItems,
      paidAmount,
      orderNumber: buildOrderNumber(sale),
    });
  };
  const openStatusSale = useMemo(
    () =>
      openStatusSaleId
        ? (sales.find((sale) => sale.id === openStatusSaleId) ?? null)
        : null,
    [openStatusSaleId, sales],
  );

  useEffect(() => {
    const options = statusMenuOptionsRef.current;
    if (!openStatusSale || !statusMenuPosition || !options) return;

    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = options;
      if (scrollHeight <= clientHeight) {
        event.preventDefault();
        return;
      }

      const deltaY = event.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((deltaY > 0 && atBottom) || (deltaY < 0 && atTop)) {
        event.preventDefault();
      }
    };

    options.addEventListener('wheel', handleWheel, { passive: false });
    return () => options.removeEventListener('wheel', handleWheel);
  }, [openStatusSale, statusMenuPosition]);

  useEffect(() => {
    if (!paymentSale) return;
    const refreshedSale = sales.find(
      (item) => item.id === paymentSale.id,
    );
    if (!refreshedSale) return;
    if (refreshedSale.updatedAt !== paymentSale.updatedAt) {
      setPaymentSale(refreshedSale);
    }
  }, [paymentSale, sales]);

  useEffect(() => {
    if (!paymentSale) return;
    const remainingPayment = getRemainingPayment(
      paymentSale,
      getPaidAmount(paymentSale),
      getLineItems(paymentSale),
    );
    const normalizedRemaining =
      Math.round(remainingPayment * 100) / 100;
    setPaymentAmount((current) => {
      const numericCurrent = Math.round(Number(current) * 100) / 100;
      if (!Number.isFinite(numericCurrent) || numericCurrent < 0) {
        return String(normalizedRemaining);
      }
      if (numericCurrent > normalizedRemaining) {
        return String(normalizedRemaining);
      }
      return current;
    });
  }, [getPaidAmount, paymentSale]);

  const selectedSaleStatusOptions = selectedSale
    ? isRepairOrder(selectedSale)
      ? repairStatuses
      : saleStatuses
    : repairStatuses;
  const selectedSaleStatus = selectedSale
    ? normalizeOrderStatus(selectedSale.status)
    : 'new';

  const getStatus = (sale: Sale): OrderStatus =>
    normalizeOrderStatus(sale.status);



  const getOrderRemainingPayment = (sale: Sale) =>
    getRemainingPayment(
      sale,
      getPaidAmount(sale),
      getLineItems(sale),
    );

  const hasAttachedProducts = (sale: Sale) =>
    getLineItems(sale).some((item) => item.kind === 'product');

  const appendTimelineEntry = (
    message: string,
    author: string = currentEmployeeName,
    kind: TimelineEntry['kind'] = 'system',
  ): TimelineEntry => ({
    id: createRuntimeId(),
    kind,
    author,
    message,
    createdAt: new Date().toISOString(),
  });

  const persistSaleWorkspace = async (
    sale: Sale,
    payload: {
      status?: OrderStatus;
      paidAmount?: number;
      masterId?: string;
      issuedById?: string;
      deviceName?: string;
      serialNumber?: string;
      discount?: Sale['discount'];
      timeline?: TimelineEntry[];
      paymentHistory?: PaymentEntry[];
      lineItems?: OrderLineItem[];
      userNote?: string;
    },
  ) => {
    const updatedSale = await updateSaleWorkspace(sale.id, {
      kind: sale.kind,
      status: payload.status ?? normalizeOrderStatus(sale.status),
      paidAmount: payload.paidAmount ?? sale.paidAmount,
      masterId: payload.masterId,
      issuedById: payload.issuedById,
      deviceName: payload.deviceName,
      serialNumber: payload.serialNumber,
      discount: payload.discount ?? sale.discount,
      timeline: payload.timeline ?? sale.timeline,
      paymentHistory: payload.paymentHistory ?? sale.paymentHistory,
      lineItems: payload.lineItems ?? getLineItems(sale),
      userNote: payload.userNote,
      expectedUpdatedAt: sale.updatedAt,
    });
    if (!isSaleResponse(updatedSale)) {
      throw new Error('Unexpected sale workspace update response from API.');
    }
    onSaleUpdate(updatedSale);
    return updatedSale;
  };

  const handleWorkspaceUpdateError = (
    error: unknown,
    fallback = t('orders.messages.errors.failedUpdateStatus'),
  ) => {
    onError(error instanceof Error && error.message ? error.message : fallback);
  };

  const queueSaleWorkspaceUpdate = (
    sale: Sale,
    payload: Parameters<typeof persistSaleWorkspace>[1],
    fallback?: string,
  ) => {
    void persistSaleWorkspace(sale, payload).catch((error) =>
      handleWorkspaceUpdateError(error, fallback),
    );
  };

  const updateStatus = async (sale: Sale, status: OrderStatus) => {
    try {
      if (isRepairStatusChangeLockedByStock(sale, status)) {
        setWarningMessage(getStockLockedRepairStatusMessage());
        setOpenStatusSaleId(null);
        return;
      }

      const remainingPayment = getOrderRemainingPayment(sale);
      const isZeroTotalSale =
        !isRepairOrder(sale) &&
        getOrderTotal(sale, getLineItems(sale)) <= 0;

      if (!isRepairOrder(sale) && status === 'returned') {
        setOpenStatusSaleId(null);
        if (
          getLineItems(sale).some((item) => item.kind === 'product')
        ) {
          await openReturnSaleModal(sale);
          return;
        }
        if (getPaidAmount(sale) > 0) {
          setWarningMessage(
            t('orders.messages.errors.refundBeforeReturned'),
          );
          return;
        }
        await persistSaleWorkspace(sale, {
          status,
          issuedById: shouldCaptureReceivedBy(sale, status)
            ? currentEmployee?.id
            : '',
          timeline: [
            appendTimelineEntry(
              buildChangedStatusTimelineMessage(currentEmployeeName, sale, status),
            ),
            ...sale.timeline,
          ],
        });
        return;
      }

      if (
        (isRepairOrder(sale) && status === 'issued') ||
        (isRepairOrder(sale) && isSalePaymentStatus(status)) ||
        (!isRepairOrder(sale) &&
          (isSalePaymentStatus(status) || status === 'issued'))
      ) {
        setOpenStatusSaleId(null);
        if (remainingPayment <= 0) {
          await persistSaleWorkspace(sale, {
            status,
            issuedById: shouldCaptureReceivedBy(sale, status)
              ? currentEmployee?.id
              : '',
            timeline: [
              appendTimelineEntry(
                buildChangedStatusTimelineMessage(currentEmployeeName, sale, status),
              ),
              ...sale.timeline,
            ],
          });
          return;
        }

        if (
          !isRepairOrder(sale) &&
          status === 'issued' &&
          !isZeroTotalSale
        ) {
          await openPaymentModal(sale, 'issued');
          return;
        }

        await openPaymentModal(
          sale,
          status as Extract<OrderStatus, PaymentTargetStatus>,
        );
        return;
      }

      if (
        isClosingStatus(sale, status) &&
        hasAttachedProducts(sale) &&
        remainingPayment > 0
      ) {
        setWarningMessage(
          t('orders.messages.errors.shippedUnpaid'),
        );
        setOpenStatusSaleId(null);
        return;
      }

      await persistSaleWorkspace(sale, {
        status,
        issuedById: shouldCaptureReceivedBy(sale, status)
          ? currentEmployee?.id
          : '',
        timeline: [
          appendTimelineEntry(
            buildChangedStatusTimelineMessage(currentEmployeeName, sale, status),
          ),
          ...sale.timeline,
        ],
      });
      setOpenStatusSaleId(null);
    } catch (error) {
      setOpenStatusSaleId(null);
      handleWorkspaceUpdateError(error);
    }
  };

  const openSaleCard = (sale: Sale) => {
    setSelectedSaleId(sale.id);
    onSelectedSaleIdChange?.(sale.id);
    setOpenStatusSaleId(null);
  };

  const closeSelectedSaleCard = useCallback(() => {
    setSelectedSaleId(null);
    onSelectedSaleIdChange?.(null);
    onExternalSaleOpenHandled?.();
    setOpenStatusSaleId(null);
  }, [onExternalSaleOpenHandled, onSelectedSaleIdChange]);

  useEffect(() => {
    if (!externalSelectedSaleId) return;

    setSelectedSaleId(externalSelectedSaleId);
    onSelectedSaleIdChange?.(externalSelectedSaleId);
    setOpenStatusSaleId(null);
    onExternalSaleOpenHandled?.();
  }, [
    externalSelectedSaleId,
    onExternalSaleOpenHandled,
    onSelectedSaleIdChange,
  ]);

  useEffect(() => {
    if (!selectedSaleId) return;

    window.requestAnimationFrame(() => {
      orderDetailAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [selectedSaleId]);

  const syncReceivedBy = async (sale: Sale, status: OrderStatus) => {
    if (
      !currentEmployee?.id ||
      !shouldCaptureReceivedBy(sale, status)
    ) {
      return sale;
    }

    return persistSaleWorkspace(sale, {
      status,
      issuedById: currentEmployee.id,
    });
  };

  const toggleColumnVisibility = (columnKey: OrdersColumnKey) => {
    setVisibleColumns((current) => {
      const currentColumns = current[activeTab];
      const availableColumns = availableColumnsByTab[activeTab];
      const lockedColumns = lockedColumnsByTab[activeTab];

      if (
        !availableColumns.includes(columnKey) ||
        lockedColumns.includes(columnKey)
      ) {
        return current;
      }

      if (
        currentColumns.includes(columnKey) &&
        currentColumns.length === lockedColumns.length + 1
      ) {
        return current;
      }

      const nextColumns = currentColumns.includes(columnKey)
        ? currentColumns.filter((key) => key !== columnKey)
        : availableColumns.filter(
            (key) =>
              key === columnKey || currentColumns.includes(key),
          );

      return {
        ...current,
        [activeTab]: nextColumns,
      };
    });
  };

  const renderOrdersCell = (
    sale: Sale,
    columnKey: OrdersColumnKey,
  ): ReactNode => {
    const status = getStatus(sale);

    switch (columnKey) {
      case 'orderNumber':
        return (
          <div className='supplier-order-number-cell'>
            <button
              type='button'
              className={
                sale.isFavorite
                  ? 'supplier-order-row-star supplier-order-row-star-active'
                  : 'supplier-order-row-star'
              }
              aria-label={
                sale.isFavorite
                  ? t('orders.toolbar.unstarOrder', {
                      orderNumber: buildOrderNumber(sale),
                    })
                  : t('orders.toolbar.starOrder', {
                      orderNumber: buildOrderNumber(sale),
                    })
              }
              aria-pressed={sale.isFavorite}
              disabled={!canManageOrderFavorite(sale)}
              onClick={(event) => {
                event.stopPropagation();
                void toggleOrderFavorite(sale);
              }}
            >
              {sale.isFavorite ? '★' : '☆'}
            </button>
            <a
              className='order-number-button'
              href={getOrderLink(sale.id, sale.kind)}
              onClick={(event) => {
                if (!isPlainLeftClick(event)) return;
                event.preventDefault();
                openSaleCard(sale);
              }}
            >
              {buildOrderNumber(sale)}
            </a>
          </div>
        );
      case 'manager':
        return (
          <TruncatedTextTooltip
            text={sale.manager?.name || '-'}
            className="orders-table-cell-truncate"
          />
        );
      case 'received':
        return (
          <TruncatedTextTooltip
            text={sale.issuedBy?.name || '-'}
            className="orders-table-cell-truncate"
          />
        );
      case 'status':
        return (
          <div className='order-status-menu'>
            <button
              type='button'
              className={`order-status order-status-${status}`}
              data-status-trigger-id={sale.id}
              onClick={() =>
                setOpenStatusSaleId((currentId) =>
                  currentId === sale.id ? null : sale.id,
                )
              }
            >
              {getStatusLabel(sale, status)}
            </button>
          </div>
        );
      case 'primaryItem': {
        const primaryItemText = getPrimaryItemCellContent(
          sale,
          activeTab,
        );
        const primaryDeviceSerial = getPrimaryDeviceSerial(sale);
        return (
          <button
            type='button'
            className='order-device-button'
            onClick={() => openSaleCard(sale)}
            title={primaryItemText}
          >
            <span>{primaryItemText}</span>
            {activeTab === 'orders' ? (
              primaryDeviceSerial ? (
                <small title={primaryDeviceSerial}>
                  {t('orders.toolbar.serialPrefix', {
                    serial: primaryDeviceSerial,
                  })}
                </small>
              ) : null
            ) : (
              <small>{t('orders.toolbar.warehouseLabel')}</small>
            )}
          </button>
        );
      }
      case 'price':
        return (
          <span
            className={
              hasNonCashPayment(sale) ? 'orders-money-non-cash' : ''
            }
          >
            {formatCurrency(getOrderTotal(sale, getLineItems(sale)))}
          </span>
        );
      case 'paid':
        return (
          <span
            className={
              hasNonCashPayment(sale) ? 'orders-money-non-cash' : ''
            }
          >
            {formatCurrency(getPaidAmount(sale))}
          </span>
        );
      case 'client': {
        const clientDisplayName = getSaleClientDisplayName(sale, t);
        const isRapidSale = isRapidSaleClientLinkDisabled(sale);
        const visits =
          clientStatsMap.get(sale.client.id)?.visits ?? 0;
        const effectiveStatus = getEffectiveClientStatusLogic(
          (sale.client.status || '') as ClientStatus | '',
          visits,
        );
        return (
          <div className='orders-client-cell'>
            {isRapidSale ? (
              <span className='orders-client-rapid-sale'>
                <TruncatedTextTooltip text={clientDisplayName} />
              </span>
            ) : (
              <button
                type='button'
                className='orders-client-link'
                onClick={() => onOpenClientCard(sale.client.id)}
              >
                <TruncatedTextTooltip text={clientDisplayName} />
              </button>
            )}
            <small>
              {!isRapidSale ? (
                <span title={sale.client.phone}>
                  <PhoneNumber value={sale.client.phone} />
                </span>
              ) : null}
              {!isRapidSale && effectiveStatus ? (
                <span
                  className={`client-status-badge ${getClientStatusClass(
                    effectiveStatus,
                  )}`}
                  style={{
                    backgroundColor: getClientStatusColor(effectiveStatus),
                    color: 'white',
                  }}
                >
                  {t(getClientStatusLabelKey(effectiveStatus))}
                </span>
              ) : null}
            </small>
          </div>
        );
      }
      case 'term':
        if (activeTab !== 'orders') return null;
        return isUrgentRepairOrder(sale) ? (
          <span className='orders-term-urgent'>
            {t('orders.toolbar.term.urgent')}
          </span>
        ) : (
          t('orders.toolbar.term.nonUrgent')
        );
      case 'warehouse':
        return (
          <TruncatedTextTooltip
            text={getWarehouseLabel(sale)}
            className="orders-table-cell-truncate"
          />
        );
      case 'master':
        return (
          <TruncatedTextTooltip
            text={sale.master?.name || '-'}
            className="orders-table-cell-truncate"
          />
        );
      case 'createdAt':
        return formatReadyDate(sale.createdAt);
      case 'readyDate':
        return formatReadyDate(getRepairCompletionDate(sale));
      default:
        return null;
    }
  };

  const addComment = (sale: Sale, comment: string) => {
    const normalizedComment = comment.trim();
    if (!normalizedComment) return;
    queueSaleWorkspaceUpdate(sale, {
      timeline: [
        appendTimelineEntry(normalizedComment, currentEmployeeName, 'manual'),
        ...sale.timeline,
      ],
    });
  };

  const updateDiscount = (
    sale: Sale,
    discount: { mode: 'percent' | 'amount'; value: number },
  ) => {
    const normalizedValue =
      Number.isFinite(discount.value) && discount.value > 0
        ? Math.round(discount.value * 100) / 100
        : 0;
    const currentDiscount = getDiscount(sale);
    if (
      currentDiscount.mode === discount.mode &&
      currentDiscount.value === normalizedValue
    ) {
      return;
    }

    // Optimistic UI update so the modal badge/mode flips immediately.
    setPaymentSale((current) =>
      current && current.id === sale.id
        ? {
            ...current,
            discount: {
              mode: discount.mode,
              value: normalizedValue,
            },
          }
        : current,
    );

    const lineItems = getLineItems(sale);
    const discountedTotal = Math.max(
      getOrderTotal(
        {
          ...sale,
          discount: {
            mode: discount.mode,
            value: normalizedValue,
          },
        },
        lineItems,
      ),
      0,
    );
    const nextPaidAmount = Math.min(
      getPaidAmount(sale),
      discountedTotal,
    );
    queueSaleWorkspaceUpdate(sale, {
      paidAmount: nextPaidAmount,
      discount: {
        mode: discount.mode,
        value: normalizedValue,
      },
    });
  };

  const openPaymentModal = async (
    sale: Sale,
    targetStatus: PaymentTargetStatus = 'issued',
  ) => {
    if (!canAcceptFinanceDeposit) {
      onError(
        t('orders.messages.errors.noAcceptPaymentPermission'),
      );
      return;
    }
    const remainingPayment = getOrderRemainingPayment(sale);

    setPaymentSale(sale);
    setPaymentTargetStatus(targetStatus);
    setPaymentAmount(String(remainingPayment));
    setPaymentMethod(getLatestDepositPaymentMethod(sale) ?? 'cash');
    setIsPaymentModalLoading(true);

    try {
      const cashboxData = await getCashboxes();
      setCashboxes(cashboxData);
      setSelectedCashboxId(
        cashboxData.find((cashbox) => cashbox.isDefault)?.id ??
          cashboxData[0]?.id ??
          '',
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedLoadCashboxes'),
      );
      setPaymentSale(null);
    } finally {
      setIsPaymentModalLoading(false);
    }
  };

  useEffect(() => {
    if (!pendingPaymentSale) return;

    void (async () => {
      await openPaymentModal(pendingPaymentSale, 'issued');
      onPendingPaymentSaleHandled?.();
    })();
  }, [pendingPaymentSale]);

  const openRefundModal = async (sale: Sale) => {
    if (!canCreateFinanceWithdraw) {
      onError(
        t('orders.messages.errors.noRefundPermission'),
      );
      return;
    }
    const currentStatus = normalizeOrderStatus(sale.status);
    if (!canRefundFromStatus(sale, currentStatus)) {
      onError(
        t('orders.messages.errors.refundUnavailableStatuses'),
      );
      return;
    }

    if (getPaidAmount(sale) <= 0) {
      onError(t('orders.messages.errors.noPaidForRefund'));
      return;
    }

    const paymentHistory = sale.paymentHistory ?? [];
    const lastDepositCashboxId =
      paymentHistory.find((entry) => entry.type === 'deposit')
        ?.cashboxId ?? '';

    setRefundSale(sale);
    setRefundAmount(String(getPaidAmount(sale)));
    setIsRefundModalLoading(true);

    try {
      const cashboxData = await getCashboxes();
      setCashboxes(cashboxData);
      setSelectedRefundCashboxId(
        lastDepositCashboxId ||
          cashboxData.find((cashbox) => cashbox.isDefault)?.id ||
          cashboxData[0]?.id ||
          '',
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedLoadCashboxes'),
      );
      setRefundSale(null);
    } finally {
      setIsRefundModalLoading(false);
    }
  };

  const openReturnLineItemModal = async (
    sale: Sale,
    item: OrderLineItem,
  ) => {
    if (item.kind !== 'product') {
      onError(
        t('orders.messages.errors.onlyProductsToWarehouse'),
      );
      return;
    }
    const saleStatus = normalizeOrderStatus(sale.status);
    const hasBoundSerials = (item.serialNumbers ?? []).length > 0;
    const isIssuedSaleStatus =
      !isRepairOrder(sale) && saleStatus === 'issued';
    const isRepairFinalStockStatus =
      isRepairOrder(sale) &&
      stockLockedRepairStatuses.has(saleStatus as RepairStatus);
    const canReturnShippedProduct =
      (isIssuedSaleStatus || isRepairFinalStockStatus) &&
      hasBoundSerials;
    const canEditAndRemove =
      isOrderEditableStatus(sale, saleStatus) &&
      getPaidAmount(sale) <= 0 &&
      !hasBoundSerials;

    if (!canReturnShippedProduct && !canEditAndRemove) {
      onError(
        t('orders.messages.errors.cannotReturnFromStatus'),
      );
      return;
    }

    if (
      (isIssuedSaleStatus || isRepairFinalStockStatus) &&
      !hasBoundSerials
    ) {
      onError(t('orders.messages.errors.bindSerialBeforeReturn'));
      return;
    }

    const itemRefundableTotal = getLineItemRefundableAmount(
      sale,
      item,
      getLineItems(sale),
    );
    const currentPaidAmount = getPaidAmount(sale);
    const maxPaidAfterReturn = Math.max(
      getOrderTotal(sale, getLineItems(sale)) - itemRefundableTotal,
      0,
    );
    if (currentPaidAmount > maxPaidAfterReturn) {
      onError(
        t('orders.messages.errors.refundBeforeLineReturn', {
          amount: formatCurrency(itemRefundableTotal),
          name: item.name,
        }),
      );
      return;
    }

    setReturnSale(sale);
    setReturnLineItem(item);
    setReturnWarehouse(t('orders.columns.serviceCenter'));
    setIsReturnModalLoading(false);
  };

  const openReturnSaleModal = async (sale: Sale) => {
    if (!canCreateFinanceWithdraw) {
      onError(
        t('orders.messages.errors.noRefundPermission'),
      );
      return;
    }
    const lastDepositCashboxId =
      (sale.paymentHistory ?? []).find(
        (entry) => entry.type === 'deposit',
      )?.cashboxId ?? '';
    const lineItems = getLineItems(sale);
    const productTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind === 'product'),
    );
    const serviceTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind !== 'product'),
    );
    const paidAmount = getPaidAmount(sale);
    const suggestedRefund = Math.min(
      productTotal,
      Math.max(paidAmount - serviceTotal, 0),
    );

    if (productTotal <= 0) {
      onError(t('orders.messages.errors.noProductsToReturn'));
      return;
    }

    if (suggestedRefund <= 0) {
      onError(
        t('orders.messages.errors.cannotReturnUnpaid'),
      );
      return;
    }

    setFullReturnSale(sale);
    setReturnRefundAmount(
      String(Math.round(suggestedRefund * 100) / 100),
    );
    setReturnWarehouse(t('orders.columns.serviceCenter'));
    setIsFullReturnModalLoading(true);

    try {
      const cashboxData = await getCashboxes();
      setCashboxes(cashboxData);
      setSelectedRefundCashboxId(
        lastDepositCashboxId ||
          cashboxData.find((cashbox) => cashbox.isDefault)?.id ||
          cashboxData[0]?.id ||
          '',
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedLoadCashboxes'),
      );
      setFullReturnSale(null);
    } finally {
      setIsFullReturnModalLoading(false);
    }
  };

  const addLineItem = (
    sale: Sale,
    item: Omit<OrderLineItem, 'id'>,
  ) => {
    const nextItem = {
      ...item,
      quantity:
        item.kind === 'product' &&
        (item.serialNumbers ?? []).length > 0
          ? 1
          : item.quantity,
      id: createRuntimeId(),
    };
    queueSaleWorkspaceUpdate(sale, {
      lineItems: [...getLineItems(sale), nextItem],
      timeline: [
        appendTimelineEntry(
          buildAddedItemTimelineMessage(currentEmployeeName, item.kind, item.name),
        ),
        ...sale.timeline,
      ],
    });
  };

  const removeLineItem = (
    sale: Sale,
    itemId: string,
    itemIndex?: number,
  ) => {
    const currentItems = getLineItems(sale);
    const removedItem =
      currentItems.find((item) => item.id === itemId) ??
      (itemIndex !== undefined ? currentItems[itemIndex] : undefined);
    if (!removedItem) return;
    const paidAmount = getPaidAmount(sale);
    if (
      !canRemoveLineItemAfterPayment(
        currentItems,
        itemId,
        itemIndex,
        paidAmount,
        getDiscount(sale),
      )
    ) {
      onError(
        t('orders.messages.errors.refundBeforeRemoveLine'),
      );
      return;
    }
    if (
      !isOrderEditableStatus(sale, normalizeOrderStatus(sale.status))
    ) {
      onError(t('orders.messages.errors.statusBlocksRemoval'));
      return;
    }
    const nextItems = removeLineItemsById(
      currentItems,
      itemId,
      itemIndex,
    );
    if (nextItems.length === 0) {
      queueSaleWorkspaceUpdate(sale, {
        lineItems: [],
        paidAmount,
      });
      return;
    }
    queueSaleWorkspaceUpdate(sale, {
      lineItems: nextItems,
      paidAmount,
      timeline: [
        appendTimelineEntry(
          removedItem.kind === 'product'
            ? buildRemovedProductTimelineMessage(currentEmployeeName, removedItem.name)
            : buildRemovedServiceTimelineMessage(currentEmployeeName, removedItem.name),
        ),
        ...sale.timeline,
      ],
    });
  };

  const replaceLineItem = (
    sale: Sale,
    itemId: string,
    itemIndex: number | undefined,
    items: Array<Omit<OrderLineItem, 'id'>>,
  ) => {
    const currentItems = getLineItems(sale);
    const replacedItem =
      currentItems.find((item) => item.id === itemId) ??
      (itemIndex !== undefined ? currentItems[itemIndex] : undefined);
    if (!replacedItem || items.length === 0) return;

    const hasMatchingId = currentItems.some(
      (item) => item.id === itemId,
    );
    const nextItems = currentItems.flatMap((item, index) => {
      const shouldReplace =
        item.id === itemId ||
        (!hasMatchingId &&
          itemIndex !== undefined &&
          itemIndex === index);
      if (!shouldReplace) return [item];
      return items.map((nextItem) => ({
        ...nextItem,
        id: createRuntimeId(),
      }));
    });

    queueSaleWorkspaceUpdate(sale, {
      lineItems: nextItems,
      timeline: [
        appendTimelineEntry(
          buildBoundSerialsTimelineMessage(currentEmployeeName, replacedItem.name),
        ),
        ...sale.timeline,
      ],
    });
  };

  const updateLineItem = (
    sale: Sale,
    itemId: string,
    itemIndex: number | undefined,
    patch: Partial<
      Pick<
        OrderLineItem,
        | 'name'
        | 'productId'
        | 'serviceId'
        | 'price'
        | 'quantity'
        | 'warrantyPeriod'
        | 'serialNumbers'
      >
    >,
  ) => {
    const currentItem =
      getLineItems(sale).find((item) => item.id === itemId) ??
      (itemIndex !== undefined
        ? getLineItems(sale)[itemIndex]
        : undefined);
    if (
      currentItem?.kind === 'product' &&
      (currentItem.serialNumbers ?? []).length > 0 &&
      patch.quantity !== undefined &&
      patch.quantity !== 1
    ) {
      onError(
        t('orders.messages.errors.oneSerialPerLine'),
      );
      return;
    }
    const nextItems = patchLineItemsById(
      getLineItems(sale),
      itemId,
      itemIndex,
      patch,
    );

    queueSaleWorkspaceUpdate(sale, {
      lineItems: nextItems,
    });
  };

  const setIssuedStatus = (status: PaymentTargetStatus = 'issued') =>
    status;

  const acceptPayment = async (action: PaymentAction) => {
    if (
      !paymentSale ||
      (action !== 'issueWithoutPayment' && !selectedCashboxId)
    )
      return;
    if (
      action !== 'issueWithoutPayment' &&
      !canAcceptFinanceDeposit
    ) {
      onError(
        t('orders.messages.errors.noAcceptPaymentPermission'),
      );
      return;
    }

    const currentPaidAmount = getPaidAmount(paymentSale);
    const currentLineItems = getLineItems(paymentSale);
    const currentPaymentRemaining = getRemainingPayment(
      paymentSale,
      currentPaidAmount,
      currentLineItems,
    );
    const normalizedAmount = parseMoney(paymentAmount);
    const nextPaymentRemaining = Math.max(
      currentPaymentRemaining -
        (action === 'issueWithoutPayment' ? 0 : normalizedAmount),
      0,
    );

    if (
      action !== 'issueWithoutPayment' &&
      (!Number.isFinite(normalizedAmount) ||
        normalizedAmount <= 0 ||
        normalizedAmount > currentPaymentRemaining)
    ) {
      onError(t('orders.messages.errors.paymentExceedsBalance'));
      return;
    }

    if (
      action === 'issueWithoutPayment' &&
      !isRepairOrder(paymentSale) &&
      paymentTargetStatus === 'issued' &&
      currentPaymentRemaining > 0
    ) {
      onError(
        t('orders.messages.errors.issuedRequiresPayment'),
      );
      return;
    }

    if (
      (action === 'depositAndIssue' ||
        action === 'issueWithoutPayment') &&
      isRepairStatusChangeLockedByStock(
        paymentSale,
        paymentTargetStatus,
      )
    ) {
      onError(getStockLockedRepairStatusMessage());
      return;
    }

    if (
      (action === 'depositAndIssue' ||
        action === 'issueWithoutPayment') &&
      hasAttachedProducts(paymentSale) &&
      paymentTargetStatus !== 'paid' &&
      nextPaymentRemaining > 0
    ) {
      setWarningMessage(
        isRepairOrder(paymentSale)
          ? t('orders.payment.repairProductsNeedFullPayment')
          : t('orders.messages.errors.shippedUnpaid'),
      );
      return;
    }

    setIsPaymentSaving(true);

    try {
      const targetStatus = setIssuedStatus(paymentTargetStatus);
      const updatedSale = await acceptSalePaymentRequest(paymentSale.id, {
        cashboxId:
          action === 'issueWithoutPayment' ? undefined : selectedCashboxId,
        amount: String(normalizedAmount),
        paymentMethod,
        action,
        targetStatus,
        author: currentEmployeeName,
        issuedById: shouldCaptureReceivedBy(paymentSale, targetStatus)
          ? currentEmployee?.id
          : '',
      });
      setPaymentSale(null);
      onSaleUpdate(updatedSale);
      if (action !== 'issueWithoutPayment') {
        setCashboxes(await getCashboxes());
        window.dispatchEvent(
          new CustomEvent('project-goods:finance-updated'),
        );
      }

      onSuccess(
        action === 'deposit'
          ? t('orders.messages.success.paymentAccepted')
          : paymentTargetStatus === 'paid'
            ? t('orders.messages.success.markedPaid')
            : paymentTargetStatus === 'issuedWithoutRepair'
              ? t('orders.messages.success.issuedWithoutRepair')
              : t('orders.messages.success.issued'),
      );
      if (action === 'depositAndIssue' || action === 'issueWithoutPayment') {
        closeSelectedSaleCard();
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedAcceptPayment'),
      );
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const refundPayment = async () => {
    if (!refundSale || !selectedRefundCashboxId) return;
    if (!canCreateFinanceWithdraw) {
      onError(
        t('orders.messages.errors.noRefundPermission'),
      );
      return;
    }
    const currentStatus = normalizeOrderStatus(refundSale.status);
    if (!canRefundFromStatus(refundSale, currentStatus)) {
      onError(
        t('orders.messages.errors.refundUnavailableStatuses'),
      );
      return;
    }

    const currentPaidAmount = getPaidAmount(refundSale);
    const normalizedAmount = parseMoney(refundAmount);

    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount <= 0 ||
      normalizedAmount > currentPaidAmount
    ) {
      onError(t('orders.messages.errors.refundExceedsPaid'));
      return;
    }

    setIsRefundSaving(true);

    try {
      const updatedSale = await refundSalePaymentRequest(refundSale.id, {
        cashboxId: selectedRefundCashboxId,
        amount: String(normalizedAmount),
        author: currentEmployeeName,
        issuedById: shouldCaptureReceivedBy(refundSale, currentStatus)
          ? (currentEmployee?.id ?? '')
          : '',
      });
      onSaleUpdate(updatedSale);
      setCashboxes(await getCashboxes());
      window.dispatchEvent(
        new CustomEvent('project-goods:finance-updated'),
      );
      onSuccess(t('orders.messages.success.refundCompleted'));
      setRefundSale(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedUpdateStatus'),
      );
    } finally {
      setIsRefundSaving(false);
    }
  };

  const returnLineItemToStock = async () => {
    if (!returnSale || !returnLineItem) return;
    if (!returnWarehouse.trim()) {
      onError(t('orders.messages.errors.warehouseRequired'));
      return;
    }

    setIsReturnSaving(true);

    try {
      let updatedSale = await returnSaleLineItemToStock(
        returnSale.id,
        {
          lineItemId: returnLineItem.id,
          warehouse: returnWarehouse,
          author: currentEmployeeName,
        },
      );

      const hasRemainingProductItems = getLineItems(updatedSale).some(
        (item) => item.kind === 'product' && item.quantity > 0,
      );
      const canAutoMarkReturned =
        !isRepairOrder(updatedSale) &&
        normalizeOrderStatus(updatedSale.status) === 'issued' &&
        getPaidAmount(updatedSale) <= 0 &&
        !hasRemainingProductItems;

      if (canAutoMarkReturned) {
        updatedSale = await persistSaleWorkspace(updatedSale, {
          status: 'returned',
          issuedById: shouldCaptureReceivedBy(updatedSale, 'returned')
            ? (currentEmployee?.id ?? '')
            : '',
          timeline: [
            appendTimelineEntry(
              buildChangedStatusTimelineMessage(
                currentEmployeeName,
                updatedSale,
                'returned',
              ),
            ),
            ...(updatedSale.timeline ?? []),
          ],
        });
      }

      onSaleUpdate(updatedSale);
      await syncReceivedBy(
        updatedSale,
        updatedSale.status as OrderStatus,
      );
      onSuccess(t('orders.messages.success.productReturned'));
      setReturnSale(null);
      setReturnLineItem(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedReturnProduct'),
      );
    } finally {
      setIsReturnSaving(false);
    }
  };

  const returnFullSaleToStock = async () => {
    if (!fullReturnSale || !selectedRefundCashboxId) return;
    if (!canCreateFinanceWithdraw) {
      onError(
        t('orders.messages.errors.noRefundPermission'),
      );
      return;
    }

    const refundAmountValue = parseMoney(returnRefundAmount);
    const lineItems = getLineItems(fullReturnSale);
    const productTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind === 'product'),
    );
    const serviceTotal = getLineItemsTotal(
      lineItems.filter((item) => item.kind !== 'product'),
    );
    const paidAmount = getPaidAmount(fullReturnSale);

    if (
      !Number.isFinite(refundAmountValue) ||
      refundAmountValue <= 0 ||
      refundAmountValue > productTotal ||
      refundAmountValue > paidAmount ||
      paidAmount - refundAmountValue > serviceTotal ||
      !returnWarehouse.trim()
    ) {
      onError(t('orders.messages.errors.invalidReturnRefund'));
      return;
    }

    setIsFullReturnSaving(true);

    try {
      const updatedSale = await returnSaleRequest(fullReturnSale.id, {
        cashboxId: selectedRefundCashboxId,
        refundAmount: String(refundAmountValue),
        warehouse: returnWarehouse,
        author: currentEmployeeName,
      });
      onSaleUpdate(updatedSale);
      await syncReceivedBy(
        updatedSale,
        updatedSale.status as OrderStatus,
      );
      setCashboxes(await getCashboxes());
      window.dispatchEvent(
        new CustomEvent('project-goods:finance-updated'),
      );
      onSuccess(
        t('orders.messages.success.saleReturned'),
      );
      setFullReturnSale(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedReturnSale'),
      );
    } finally {
      setIsFullReturnSaving(false);
    }
  };

  const saveOrderMainInfo = async (
    sale: Sale,
    payload: {
      deviceName: string;
      serialNumber: string;
      masterId: string;
      status: OrderStatus;
    },
  ) => {
    try {
      if (isRepairStatusChangeLockedByStock(sale, payload.status)) {
        const message = getStockLockedRepairStatusMessage();
        onError(message);
        throw new Error(message);
      }
      const lineItems = getLineItems(sale);
      if (
        isRepairOrder(sale) &&
        payload.status === 'issued' &&
        lineItems.some((item) => item.kind === 'product') &&
        getRemainingPayment(sale, getPaidAmount(sale), lineItems) > 0
      ) {
        const message = t('orders.messages.errors.fullPaymentBeforeIssue');
        onError(message);
        throw new Error(message);
      }
      if (
        !isRepairOrder(sale) &&
        payload.status === 'returned' &&
        hasSaleReturnObligations(sale, lineItems)
      ) {
        if (lineItems.some((item) => item.kind === 'product')) {
          await openReturnSaleModal(sale);
        } else {
          const message = t('orders.messages.errors.refundBeforeReturned');
          onError(message);
          throw new Error(message);
        }
        return;
      }

      const timeline = [
        appendTimelineEntry(
          buildUpdatedMainInfoTimelineMessage(currentEmployeeName),
        ),
        ...sale.timeline,
      ];
      const shouldAssignIssuedBy = shouldCaptureReceivedBy(
        sale,
        payload.status,
      );
      await persistSaleWorkspace(sale, {
        status: payload.status,
        masterId: payload.masterId,
        deviceName: payload.deviceName,
        serialNumber: payload.serialNumber,
        issuedById:
          shouldAssignIssuedBy && currentEmployee?.id
            ? currentEmployee.id
            : '',
        timeline,
      });

      onSuccess(t('orders.messages.success.mainInfoUpdated'));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedSaveMainInfo');
      onError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const saveOrderUserNote = async (sale: Sale, userNote: string) => {
    try {
      const normalizedUserNote = userNote.trim();
      const currentUserNote = (sale.userNote ?? '').trim();
      if (normalizedUserNote === currentUserNote) {
        return;
      }

      const timeline = [
        appendTimelineEntry(
          buildUpdatedUserNoteTimelineMessage(currentEmployeeName),
        ),
        ...sale.timeline,
      ];
      await persistSaleWorkspace(sale, {
        userNote: normalizedUserNote,
        timeline,
      });
      onSuccess(t('orders.messages.success.userNoteUpdated'));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : t('orders.messages.errors.failedSaveUserNote'),
      );
    }
  };

  return (
    <section className='orders-page'>
      {selectedSaleId && !selectedSale ? (
        <div ref={orderDetailAnchorRef}>
          <OrderDetailCardSkeleton />
        </div>
      ) : null}
      {selectedSale ? (
        <div ref={orderDetailAnchorRef}>
          <OrderDetailCard
            sale={selectedSale}
            sales={sales}
            supplierOrders={supplierOrders}
            employees={employees}
            status={selectedSaleStatus}
            statusOptions={selectedSaleStatusOptions}
            comments={selectedSale.timeline ?? []}
            lineItems={getLineItems(selectedSale)}
            products={products}
            printForms={printForms}
            clientDevices={clientDevices}
            catalogProducts={catalogProducts}
            paidAmount={getPaidAmount(selectedSale)}
            isReadOnly={
              !isRepairOrder(selectedSale) &&
              !isOrderEditableStatus(
                selectedSale,
                normalizeOrderStatus(selectedSale.status),
              )
            }
            canAddComment={canChatInOrders}
            canAcceptPayment={canAcceptFinanceDeposit}
            canRefundPayment={canCreateFinanceWithdraw}
            canCreateOrders={canCreateOrders}
            onCreateOrder={() =>
              onCreateOrder(
                isRepairOrder(selectedSale) ? 'orders' : 'sales',
              )
            }
            createOrderHref={getCreateOrderHref(
              isRepairOrder(selectedSale) ? 'orders' : 'sales',
            )}
            onClose={closeSelectedSaleCard}
            onAddComment={(comment) =>
              addComment(selectedSale, comment)
            }
            onAddLineItem={(item) => addLineItem(selectedSale, item)}
            onReplaceLineItem={(itemId, itemIndex, nextItems) =>
              replaceLineItem(
                selectedSale,
                itemId,
                itemIndex,
                nextItems,
              )
            }
            onRemoveLineItem={(itemId, itemIndex) =>
              removeLineItem(selectedSale, itemId, itemIndex)
            }
            onUpdateLineItem={(itemId, itemIndex, patch) =>
              updateLineItem(selectedSale, itemId, itemIndex, patch)
            }
            onReturnLineItem={(item) =>
              openReturnLineItemModal(selectedSale, item)
            }
            onOpenRelatedSale={openSaleCard}
            onAcceptPayment={() =>
              openPaymentModal(
                selectedSale,
                'issued',
              )
            }
            onOpenPrint={() =>
              openPrintDialog(
                selectedSale,
                getLineItems(selectedSale),
                getPaidAmount(selectedSale),
              )
            }
            onRefundPayment={() => openRefundModal(selectedSale)}
            onDiscountChange={(discount) =>
              updateDiscount(selectedSale, discount)
            }
            onOpenClientCard={() =>
              onOpenClientCard(selectedSale.client.id)
            }
            onSupplierOrderCreated={refreshSupplierOrders}
            onCreateClientDevice={onCreateClientDevice}
            onUpdateClientDevice={onUpdateClientDevice}
            onDeleteClientDevice={onDeleteClientDevice}
            onUpdateProductModel={onUpdateProductModel}
            onError={onError}
            onSuccess={onSuccess}
            onSaveMainInfo={(payload) =>
              saveOrderMainInfo(selectedSale, payload)
            }
            onSaveUserNote={(userNote) =>
              saveOrderUserNote(selectedSale, userNote)
            }
          />
        </div>
      ) : null}

      <OrdersWorkspaceListHeader
        activeTab={activeTab}
        visibleTabs={visibleTabs}
        searchValue={searchValue}
        createOrderHref={createOrderHref}
        canCreateOrders={canCreateOrders}
        filteredOrdersCount={filteredOrders.length}
        currentPage={currentPage}
        currentPageSize={currentPageSize}
        activeFiltersCount={activeFiltersCount}
        isFilterPanelOpen={isFilterPanelOpen}
        isColumnsMenuOpen={isColumnsMenuOpen}
        favoritesOnly={appliedFilters.favoritesOnly}
        visibleColumnKeys={visibleColumnKeys}
        columnsMenuRef={columnsMenuRef}
        onActiveTabChange={onActiveTabChange}
        onSearchChange={onSearchChange}
        onCreateOrder={onCreateOrder}
        onPageChange={(page) =>
          setPageByTab((current) => ({
            ...current,
            [activeTab]: page,
          }))
        }
        onToggleFilterPanel={toggleFilterPanel}
        onToggleColumnsMenu={() =>
          setIsColumnsMenuOpen((current) => !current)
        }
        onToggleColumnVisibility={toggleColumnVisibility}
        onToggleFavoritesOnly={toggleFavoritesOnly}
      />

      <OrdersWorkspaceFilterPanel
        isFilterPanelOpen={isFilterPanelOpen}
        isStatusFilterOpen={isStatusFilterOpen}
        isSaveFilterDrawerOpen={isSaveFilterDrawerOpen}
        canManageSavedFilters={canManageSavedFilters}
        visibleSavedFilters={visibleSavedFilters}
        employeeSavedFilters={employeeSavedFilters}
        draftFilters={draftFilters}
        statusOptionsForActiveTab={statusOptionsForActiveTab}
        assigneeOptions={assigneeOptions}
        warehouseOptions={warehouseOptions}
        newFilterName={newFilterName}
        newFilterIcon={newFilterIcon}
        statusFilterRef={statusFilterRef}
        setDraftFilters={setDraftFilters}
        setIsStatusFilterOpen={setIsStatusFilterOpen}
        setIsSaveFilterDrawerOpen={setIsSaveFilterDrawerOpen}
        setNewFilterName={setNewFilterName}
        setNewFilterIcon={setNewFilterIcon}
        onToggleStatusFilter={toggleStatusFilter}
        onToggleAllStatuses={toggleAllStatuses}
        onApplyFilters={applyFilters}
        onResetFilters={resetFilters}
        onSaveCurrentFilter={saveCurrentFilter}
        onApplySavedFilter={applySavedFilter}
        onRemoveSavedFilter={removeSavedFilter}
      />

      <OrdersActiveFilterChips
        filters={appliedFilters}
        assigneeLabelById={assigneeLabelById}
        onChangeFilters={applyFiltersPatch}
        onClearAll={resetFilters}
      />

      <OrdersWorkspaceTableSection
        activeTab={activeTab}
        isLoading={isLoading}
        filteredOrders={filteredOrders}
        paginatedOrders={paginatedOrders}
        visibleColumnKeys={visibleColumnKeys}
        tableMinWidth={tableMinWidth}
        currentPage={currentPage}
        currentPageSize={currentPageSize}
        ordersTableWrapRef={ordersTableWrapRef}
        openStatusSale={openStatusSale}
        statusMenuPosition={statusMenuPosition}
        statusMenuOptionsRef={statusMenuOptionsRef}
        getStatus={getStatus}
        renderOrdersCell={renderOrdersCell}
        onPageChange={(page) =>
          setPageByTab((current) => ({
            ...current,
            [activeTab]: page,
          }))
        }
        onPageSizeChange={(pageSize) => {
          setPageSizeByTab((current) => ({
            ...current,
            [activeTab]: pageSize,
          }));
          setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
        }}
        onUpdateStatus={updateStatus}
      />

      <OrdersWorkspaceModals
        printForms={printForms}
        printCompanySettings={printCompanySettings}
        paymentSale={paymentSale}
        paymentTargetStatus={paymentTargetStatus}
        cashboxes={cashboxes}
        selectedCashboxId={selectedCashboxId}
        paymentMethod={paymentMethod}
        paymentAmount={paymentAmount}
        isPaymentModalLoading={isPaymentModalLoading}
        isPaymentSaving={isPaymentSaving}
        refundSale={refundSale}
        selectedRefundCashboxId={selectedRefundCashboxId}
        refundAmount={refundAmount}
        isRefundModalLoading={isRefundModalLoading}
        isRefundSaving={isRefundSaving}
        returnSale={returnSale}
        returnLineItem={returnLineItem}
        returnWarehouse={returnWarehouse}
        isReturnModalLoading={isReturnModalLoading}
        isReturnSaving={isReturnSaving}
        fullReturnSale={fullReturnSale}
        returnRefundAmount={returnRefundAmount}
        isFullReturnModalLoading={isFullReturnModalLoading}
        isFullReturnSaving={isFullReturnSaving}
        printRequest={printRequest}
        warningMessage={warningMessage}
        getLineItems={getLineItems}
        getPaidAmount={getPaidAmount}
        onPaymentSaleClose={() => setPaymentSale(null)}
        onRefundSaleClose={() => setRefundSale(null)}
        onReturnClose={() => {
          setReturnSale(null);
          setReturnLineItem(null);
        }}
        onFullReturnClose={() => setFullReturnSale(null)}
        onPrintRequestClose={() => setPrintRequest(null)}
        onWarningClose={() => setWarningMessage(null)}
        onCashboxChange={setSelectedCashboxId}
        onPaymentMethodChange={setPaymentMethod}
        onPaymentAmountChange={setPaymentAmount}
        onRefundCashboxChange={setSelectedRefundCashboxId}
        onRefundAmountChange={setRefundAmount}
        onReturnWarehouseChange={setReturnWarehouse}
        onReturnRefundAmountChange={setReturnRefundAmount}
        onOpenPrint={openPrintDialog}
        onAcceptPayment={acceptPayment}
        onRefundPayment={refundPayment}
        onReturnLineItemToStock={returnLineItemToStock}
        onReturnFullSaleToStock={returnFullSaleToStock}
      />
    </section>
  );
};
