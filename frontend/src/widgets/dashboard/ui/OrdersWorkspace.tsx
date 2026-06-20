import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { hasEmployeePermission } from '../../../entities/employee/model/permissions';
import type { Sale } from '../../../entities/sale/model/types';
import { isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import { formatCurrency } from '../../../shared/lib/format';
import { parseMoney } from '../../../shared/lib/decimal';
import {
  getSaleClientPhones,
  saleMatchesPhoneQuery,
} from '../../../entities/client/lib/phone-match';
import { normalizePhone } from '../../../shared/lib/phoneFormatter';
import { getCashboxes } from '../../../entities/finance/api/financeApi';
import {
  acceptSalePayment as acceptSalePaymentRequest,
  refundSalePayment as refundSalePaymentRequest,
  returnSale as returnSaleRequest,
  returnSaleLineItemToStock,
  updateSaleFavorite,
  updateSaleWorkspace,
} from '../../../entities/sale/api/saleApi';
import { getSupplierOrders } from '../../../entities/supplier-order/api/supplierOrderApi';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import type { Cashbox } from '../../../entities/finance/model/types';
import {
  CompactPaginationPanel,
  PaginationPanel,
} from '../../../shared/ui/PaginationPanel';
import { TruncatedTextTooltip } from '../../../shared/ui/TruncatedTextTooltip';
import {
  MessageModal,
  PaymentModal,
  RefundModal,
  ReturnLineItemModal,
  ReturnSaleModal,
} from './OrderPaymentModals';
import { OrderDetailCard } from './OrderDetailCard';
import { getOrderLink } from './create-order-card-shared';
import {
  canRemoveLineItemAfterPayment,
  patchLineItemsById,
  removeLineItemsById,
} from '../model/line-item-ops';
import { createRuntimeId } from '../../../shared/lib/runtime-id';
import {
  activeOrdersFiltersStorageKey,
  availableColumnsByTab,
  buildOrderNumber,
  canRefundFromStatus,
  emptyOrdersFilters,
  filterIconOptions,
  formatReadyDate,
  getColumnLabel,
  getCreatedTime,
  getClientStatusClass,
  getDefaultLineItems,
  getDiscount,
  getIsoDatePart,
  getLatestDepositPaymentMethod,
  getLineItemRefundableAmount,
  getLineItemsTotal,
  getOrderBaseTotal,
  getOrderTotal,
  getOrdersColumnClassName,
  getOrdersSearchPlaceholder,
  getPrimaryDeviceName,
  getPrimaryDeviceSerial,
  getPrimaryItemCellContent,
  getRepairCompletionDate,
  getRemainingPayment,
  getSalePaidAmount,
  getStatusLabel,
  getStatusOptionsForSale,
  getWarehouseLabel,
  hasNonCashPayment,
  hasSaleReturnObligations,
  isOrderEditableStatus,
  isClosingStatus,
  isIssueWithoutPaymentBlockedForSale,
  isIsoDateWithinRange,
  isPlainLeftClick,
  isRepairDevicePlaceholderLineItem,
  isRepairStatusChangeLockedByStock,
  isSalePaymentStatus,
  isUrgentRepairOrder,
  lockedColumnsByTab,
  normalizeOrderStatus,
  orderTabs,
  ordersColumnsStorageKey,
  readActiveOrderFilters,
  readSavedOrderFilters,
  readVisibleColumns,
  repairStatuses,
  saleStatuses,
  savedOrdersFiltersStorageKey,
  shouldCaptureReceivedBy,
  stockLockedRepairStatuses,
  stockLockedRepairStatusMessage,
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
  type RepairTypeFilter,
  type SavedOrdersFilter,
  type TimelineEntry,
} from './orders-workspace-shared';
import { OrderPrintDialog } from './OrderPrintDialog';
import { PhoneNumber } from './PhoneNumber';

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
  onUpdateProductModel,
}: OrdersWorkspaceProps) => {
  const currentEmployeeName =
    currentEmployee?.name ?? 'Unknown employee';
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
  const [printRequest, setPrintRequest] =
    useState<OrderPrintRequest | null>(null);
  const [openStatusSaleId, setOpenStatusSaleId] = useState<
    string | null
  >(null);
  const [statusMenuPosition, setStatusMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
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
    useState('Service center');
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
  const [supplierOrders, setSupplierOrders] = useState<
    SupplierOrder[]
  >([]);
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
        map.set(sale.master.id, `${sale.master.name} (Master)`);
      }
      if (sale.manager) {
        map.set(sale.manager.id, `${sale.manager.name} (Manager)`);
      }
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((first, second) =>
        first.label.localeCompare(second.label),
      );
  }, [tabSales]);
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
      const searchValues =
        activeTab === 'orders'
          ? [getPrimaryDeviceName(sale), sale.client.name, ...salePhones]
          : [
              sale.client.name,
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
          [sale.client.name, String(orderNumber)].some((value) =>
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
          ? 'Current employee does not have permission to manage sales.'
          : 'Current employee does not have permission to manage orders.',
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
          : 'Failed to update order star.',
      );
    }
  };

  const currentPage = pageByTab[activeTab];
  const currentPageSize = pageSizeByTab[activeTab];
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * currentPageSize;
    return filteredOrders.slice(start, start + currentPageSize);
  }, [currentPage, currentPageSize, filteredOrders]);

  const loadSupplierOrders = useCallback(async () => {
    if (!canViewSupplierOrders) {
      setSupplierOrders([]);
      return;
    }

    try {
      setSupplierOrders(await getSupplierOrders(''));
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to load supplier orders.',
      );
    }
  }, [canViewSupplierOrders, onError]);

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
  const saveCurrentFilter = () => {
    if (!currentEmployee?.id) {
      onError('Current employee is required to save filters.');
      return;
    }
    const name = newFilterName.trim();
    if (!name) {
      onError('Enter a filter name.');
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
    onSuccess('Filter saved.');
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

      const rect = trigger.getBoundingClientRect();
      setStatusMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    };

    syncStatusMenuPosition();

    const handleResize = () => {
      setOpenStatusSaleId(null);
    };

    const handleScroll = () => {
      if (activeTab === 'orders') {
        syncStatusMenuPosition();
        return;
      }
      setOpenStatusSaleId(null);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeTab, openStatusSaleId]);

  const selectedSale = useMemo(
    () => sales.find((sale) => sale.id === selectedSaleId) ?? null,
    [sales, selectedSaleId],
  );

  useEffect(() => {
    if (!selectedSale || !canViewSupplierOrders) return;
    void loadSupplierOrders();
  }, [canViewSupplierOrders, loadSupplierOrders, selectedSale]);
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

  const getStatusOptions = getStatusOptionsForSale;

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
    fallback = 'Failed to update order status.',
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
        setWarningMessage(stockLockedRepairStatusMessage);
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
            'Refund client payment before marking sale as returned.',
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
              `${currentEmployeeName} changed status to "${getStatusLabel(sale, status)}".`,
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
                `${currentEmployeeName} changed status to "${getStatusLabel(sale, status)}".`,
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
          'Product shipped but payment has not been received.',
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
            `${currentEmployeeName} changed status to "${getStatusLabel(sale, status)}".`,
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
                  ? `Remove star from ${buildOrderNumber(sale)}`
                  : `Star ${buildOrderNumber(sale)}`
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
                  {`S/N: ${primaryDeviceSerial}`}
                </small>
              ) : null
            ) : (
              <small>Warehouse: Service center</small>
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
      case 'client':
        return (
          <div className='orders-client-cell'>
            <button
              type='button'
              className='orders-client-link'
              onClick={() => onOpenClientCard(sale.client.id)}
            >
              <TruncatedTextTooltip text={sale.client.name} />
            </button>
            <small>
              <span title={sale.client.phone}>
                <PhoneNumber value={sale.client.phone} />
              </span>
              <span
                className={`client-status-badge ${getClientStatusClass(
                  String(sale.client.status || ''),
                )}`}
              >
                {sale.client.status || 'new'}
              </span>
            </small>
          </div>
        );
      case 'term':
        if (activeTab !== 'orders') return null;
        return isUrgentRepairOrder(sale) ? (
          <span className='orders-term-urgent'>Urgent</span>
        ) : (
          'Non-urgent'
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
        'Current employee does not have permission to accept payments.',
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
          : 'Failed to load cashboxes.',
      );
      setPaymentSale(null);
    } finally {
      setIsPaymentModalLoading(false);
    }
  };

  const openRefundModal = async (sale: Sale) => {
    if (!canCreateFinanceWithdraw) {
      onError(
        'Current employee does not have permission to refund payments.',
      );
      return;
    }
    const currentStatus = normalizeOrderStatus(sale.status);
    if (!canRefundFromStatus(sale, currentStatus)) {
      onError(
        'Refund is unavailable for "Issued", "Client rejected", and "Issued without repair" repair orders.',
      );
      return;
    }

    if (getPaidAmount(sale) <= 0) {
      onError('No paid amount is available for refund.');
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
          : 'Failed to load cashboxes.',
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
        'Only product items can be received back to warehouse.',
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
        'This product cannot be returned to stock from current status.',
      );
      return;
    }

    if (
      (isIssuedSaleStatus || isRepairFinalStockStatus) &&
      !hasBoundSerials
    ) {
      onError('Bind shipped serial number before return to stock.');
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
        `Refund ${formatCurrency(itemRefundableTotal)} to client first, then return "${item.name}" to stock.`,
      );
      return;
    }

    setReturnSale(sale);
    setReturnLineItem(item);
    setReturnWarehouse('Service center');
    setIsReturnModalLoading(false);
  };

  const openReturnSaleModal = async (sale: Sale) => {
    if (!canCreateFinanceWithdraw) {
      onError(
        'Current employee does not have permission to refund payments.',
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
      onError('Sale has no products to return to stock.');
      return;
    }

    if (suggestedRefund <= 0) {
      onError(
        'Cannot return a sale without received payment. Use another status for unpaid cancellation.',
      );
      return;
    }

    setFullReturnSale(sale);
    setReturnRefundAmount(
      String(Math.round(suggestedRefund * 100) / 100),
    );
    setReturnWarehouse('Service center');
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
          : 'Failed to load cashboxes.',
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
          `${currentEmployeeName} added ${item.kind} "${item.name}".`,
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
        'Refund the line item amount before removing it from the order.',
      );
      return;
    }
    if (
      !isOrderEditableStatus(sale, normalizeOrderStatus(sale.status))
    ) {
      onError('This order status does not allow line item removal.');
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
            ? `${currentEmployeeName} removed product "${removedItem.name}" from order.`
            : `${currentEmployeeName} removed service "${removedItem.name}" from order.`,
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
          `${currentEmployeeName} bound serial numbers for "${replacedItem.name}".`,
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
        'Serialized products are sold one serial per line. Add another serial instead.',
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
        'Current employee does not have permission to accept payments.',
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
      onError('Payment amount cannot exceed the remaining balance.');
      return;
    }

    if (
      action === 'issueWithoutPayment' &&
      !isRepairOrder(paymentSale) &&
      paymentTargetStatus === 'issued' &&
      currentPaymentRemaining > 0
    ) {
      onError(
        'Issued status requires payment to cashbox. Use payment action or keep unpaid status.',
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
      onError(stockLockedRepairStatusMessage);
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
          ? 'Repair orders with products can be issued after full payment.'
          : 'Product shipped but payment has not been received.',
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
          ? 'Payment accepted to cashbox.'
          : paymentTargetStatus === 'paid'
            ? 'Order marked as paid successfully.'
            : paymentTargetStatus === 'issuedWithoutRepair'
              ? 'Order issued without repair successfully.'
              : 'Order issued successfully.',
      );
      if (action === 'depositAndIssue' || action === 'issueWithoutPayment') {
        closeSelectedSaleCard();
      }
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to accept payment.',
      );
    } finally {
      setIsPaymentSaving(false);
    }
  };

  const refundPayment = async () => {
    if (!refundSale || !selectedRefundCashboxId) return;
    if (!canCreateFinanceWithdraw) {
      onError(
        'Current employee does not have permission to refund payments.',
      );
      return;
    }
    const currentStatus = normalizeOrderStatus(refundSale.status);
    if (!canRefundFromStatus(refundSale, currentStatus)) {
      onError(
        'Refund is unavailable for "Issued", "Client rejected", and "Issued without repair" repair orders.',
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
      onError('Refund amount cannot exceed the paid amount.');
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
      onSuccess('Refund completed successfully.');
      setRefundSale(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to refund payment.',
      );
    } finally {
      setIsRefundSaving(false);
    }
  };

  const returnLineItemToStock = async () => {
    if (!returnSale || !returnLineItem) return;
    if (!returnWarehouse.trim()) {
      onError('Warehouse is required.');
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
              `${currentEmployeeName} changed status to "${getStatusLabel(updatedSale, 'returned')}".`,
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
      onSuccess('Product returned to stock.');
      setReturnSale(null);
      setReturnLineItem(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to return product.',
      );
    } finally {
      setIsReturnSaving(false);
    }
  };

  const returnFullSaleToStock = async () => {
    if (!fullReturnSale || !selectedRefundCashboxId) return;
    if (!canCreateFinanceWithdraw) {
      onError(
        'Current employee does not have permission to refund payments.',
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
      onError('Refund amount is not valid for this return.');
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
        'Sale returned, products moved back to stock, and refund completed.',
      );
      setFullReturnSale(null);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to return sale.',
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
        onError(stockLockedRepairStatusMessage);
        return;
      }
      const lineItems = getLineItems(sale);
      if (
        isRepairOrder(sale) &&
        payload.status === 'issued' &&
        lineItems.some((item) => item.kind === 'product') &&
        getRemainingPayment(sale, getPaidAmount(sale), lineItems) > 0
      ) {
        onError(
          'Accept full payment before issuing attached products.',
        );
        return;
      }
      if (
        !isRepairOrder(sale) &&
        payload.status === 'returned' &&
        hasSaleReturnObligations(sale, lineItems)
      ) {
        if (lineItems.some((item) => item.kind === 'product')) {
          await openReturnSaleModal(sale);
        } else {
          onError(
            'Refund client payment before marking sale as returned.',
          );
        }
        return;
      }

      const timeline = [
        appendTimelineEntry(
          `${currentEmployeeName} updated order main information.`,
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

      onSuccess('Order main information updated.');
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to save order main information.',
      );
    }
  };

  return (
    <section className='orders-page'>
      {selectedSale ? (
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
          onSupplierOrderCreated={loadSupplierOrders}
          onCreateClientDevice={onCreateClientDevice}
          onUpdateProductModel={onUpdateProductModel}
          onError={onError}
          onSuccess={onSuccess}
          onSaveMainInfo={(payload) =>
            saveOrderMainInfo(selectedSale, payload)
          }
        />
      ) : null}

      <div
        className='orders-tabs'
        role='tablist'
        aria-label='Order categories'
      >
        {orderTabs
          .filter((tab) => visibleTabs.includes(tab.key))
          .map((tab) => (
            <button
              key={tab.key}
              type='button'
              className={
                tab.key === activeTab
                  ? 'orders-tab orders-tab-active'
                  : 'orders-tab'
              }
              onClick={() => onActiveTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
      </div>

      <div className='orders-toolbar'>
        <div className='orders-toolbar-left'>
          <CompactPaginationPanel
            totalItems={filteredOrders.length}
            page={currentPage}
            pageSize={currentPageSize}
            onPageChange={(page) =>
              setPageByTab((current) => ({
                ...current,
                [activeTab]: page,
              }))
            }
          />
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isFilterPanelOpen}
            onClick={toggleFilterPanel}
          >
            Filter
            {activeFiltersCount > 0 ? (
              <span className='toolbar-filter-count'>
                {activeFiltersCount}
              </span>
            ) : null}
          </button>
          <div className='toolbar-settings' ref={columnsMenuRef}>
            <button
              type='button'
              className='toolbar-square-button'
              aria-label='Toggle table columns'
              aria-expanded={isColumnsMenuOpen}
              onClick={() =>
                setIsColumnsMenuOpen((current) => !current)
              }
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                className='toolbar-square-button-icon'
                fill='currentColor'
              >
                <path d='M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.63.25-1.21.57-1.75.95l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.33.68.22l2.49-1c.54.38 1.12.7 1.75.95l.38 2.65c.04.27.26.47.49.47h4c.27 0 .5-.2.54-.47l.38-2.65c.63-.25 1.21-.57 1.75-.95l2.49 1c.26.11.54.02.68-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z' />
              </svg>
            </button>
            {isColumnsMenuOpen ? (
              <div className='toolbar-settings-menu'>
                {availableColumnsByTab[activeTab].map((columnKey) => (
                  <label
                    key={`${activeTab}-${columnKey}`}
                    className='toolbar-settings-option'
                  >
                    <input
                      type='checkbox'
                      checked={visibleColumnKeys.includes(columnKey)}
                      disabled={lockedColumnsByTab[
                        activeTab
                      ].includes(columnKey)}
                      onChange={() =>
                        toggleColumnVisibility(columnKey)
                      }
                    />
                    <span>
                      {getColumnLabel(columnKey, activeTab)}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type='button'
            className={
              appliedFilters.favoritesOnly
                ? 'toolbar-square-button toolbar-star-button toolbar-star-button-active'
                : 'toolbar-square-button toolbar-star-button'
            }
            aria-label={
              appliedFilters.favoritesOnly
                ? activeTab === 'orders'
                  ? 'Show all orders'
                  : 'Show all sales'
                : activeTab === 'orders'
                  ? 'Show starred orders'
                  : 'Show starred sales'
            }
            aria-pressed={appliedFilters.favoritesOnly}
            onClick={toggleFavoritesOnly}
          >
            <span className='supplier-order-star-icon' aria-hidden='true'>
              {appliedFilters.favoritesOnly ? '★' : '☆'}
            </span>
          </button>
          <div className='orders-search-group orders-search-group-clearable'>
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={getOrdersSearchPlaceholder(activeTab)}
              aria-label='Search orders'
            />
            {searchValue ? (
              <span
                role='button'
                tabIndex={0}
                className='orders-search-clear'
                aria-label='Clear search text'
                onClick={() => onSearchChange('')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSearchChange('');
                  }
                }}
              >
                x
              </span>
            ) : null}
          </div>
        </div>
        <div className='orders-toolbar-actions'>
          <a
            className={
              canCreateOrders
                ? 'orders-create-button'
                : 'orders-create-button orders-create-button-disabled'
            }
            href={canCreateOrders ? createOrderHref : '#'}
            aria-disabled={!canCreateOrders}
            tabIndex={canCreateOrders ? undefined : -1}
            onClick={(event) => {
              if (!canCreateOrders) {
                event.preventDefault();
                return;
              }

              if (!isPlainLeftClick(event)) return;
              event.preventDefault();
              onCreateOrder(activeTab);
            }}
            title={
              canCreateOrders
                ? 'Create order'
                : 'Only employees with orders.manage permission can create orders.'
            }
          >
            Create order
          </a>
        </div>
      </div>

      <section
        className={
          isFilterPanelOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
        aria-hidden={!isFilterPanelOpen}
      >
        <div className='orders-filter-saved-row'>
          <p>Saved filters:</p>
          <div className='orders-filter-saved-list'>
            {visibleSavedFilters.length > 0 ? (
              visibleSavedFilters.map((savedFilter) => (
                <div
                  key={savedFilter.id}
                  className='orders-filter-saved-item'
                >
                  <button
                    type='button'
                    className='orders-filter-saved-button'
                    onClick={() => applySavedFilter(savedFilter)}
                    title={savedFilter.name}
                  >
                    <span>{savedFilter.icon}</span>
                    <span>{savedFilter.name}</span>
                  </button>
                  <button
                    type='button'
                    className='orders-filter-delete-button'
                    aria-label={`Delete ${savedFilter.name}`}
                    onClick={() => removeSavedFilter(savedFilter.id)}
                  >
                    🗑️
                  </button>
                </div>
              ))
            ) : (
              <small>No saved filters for this tab.</small>
            )}
          </div>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => setIsSaveFilterDrawerOpen(true)}
            disabled={!canManageSavedFilters}
            title={
              canManageSavedFilters
                ? 'Save filter'
                : 'Employee profile is required to save filters.'
            }
          >
            Save filter
          </button>
        </div>

        <div className='orders-filter-grid'>
          <div
            className='orders-filter-field orders-filter-status-field'
            ref={statusFilterRef}
          >
            <span>Status</span>
            <button
              type='button'
              className='orders-filter-status-toggle'
              aria-expanded={isStatusFilterOpen}
              onClick={() =>
                setIsStatusFilterOpen((current) => !current)
              }
            >
              {draftFilters.statuses.length > 0
                ? `${draftFilters.statuses.length} selected`
                : 'All'}
            </button>
            {isStatusFilterOpen ? (
              <div className='orders-filter-status-menu'>
                <label className='orders-filter-status-all'>
                  <input
                    type='checkbox'
                    checked={
                      draftFilters.statuses.length ===
                      statusOptionsForActiveTab.length
                    }
                    onChange={toggleAllStatuses}
                  />
                  <strong>All</strong>
                </label>
                {statusOptionsForActiveTab.map((statusOption) => (
                  <label key={statusOption.key}>
                    <input
                      type='checkbox'
                      checked={draftFilters.statuses.includes(
                        statusOption.key,
                      )}
                      onChange={() =>
                        toggleStatusFilter(statusOption.key)
                      }
                    />
                    <span>{statusOption.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <label className='orders-filter-field'>
            <span>Order number</span>
            <input
              type='text'
              value={draftFilters.orderNumber}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  orderNumber: event.target.value,
                }))
              }
              placeholder='Order #'
            />
          </label>

          <label className='orders-filter-field'>
            <span>Client</span>
            <input
              type='text'
              value={draftFilters.client}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  client: event.target.value,
                }))
              }
              placeholder='Client name or phone'
            />
          </label>

          <label className='orders-filter-field'>
            <span>Master / manager</span>
            <select
              value={draftFilters.assigneeId}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  assigneeId: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.label}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Warehouse</span>
            <select
              value={draftFilters.warehouse}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  warehouse: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {warehouseOptions.map((warehouse) => (
                <option key={warehouse} value={warehouse}>
                  {warehouse}
                </option>
              ))}
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Repair type</span>
            <select
              value={draftFilters.repairType}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  repairType: event.target.value as RepairTypeFilter,
                }))
              }
            >
              <option value='all'>All</option>
              <option value='paid'>Paid</option>
              <option value='warranty'>Warranty</option>
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Date from</span>
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
            <span>Date to</span>
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

          <label className='orders-filter-field'>
            <span>Payment method</span>
            <select
              value={draftFilters.paymentMethod}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  paymentMethod: event.target.value as
                    | ''
                    | PaymentMethod,
                }))
              }
            >
              <option value=''>All</option>
              <option value='cash'>Cash</option>
              <option value='non-cash'>Non-cash</option>
            </select>
          </label>

          <label className='orders-filter-field'>
            <span>Product</span>
            <input
              type='text'
              value={draftFilters.product}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  product: event.target.value,
                }))
              }
              placeholder='Product name'
            />
          </label>

          <label className='orders-filter-field'>
            <span>Service</span>
            <input
              type='text'
              value={draftFilters.service}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  service: event.target.value,
                }))
              }
              placeholder='Service name'
            />
          </label>
        </div>

        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={applyFilters}
          >
            Apply
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={resetFilters}
          >
            Clear
          </button>
        </div>
      </section>

      {isSaveFilterDrawerOpen ? (
        <div
          className='orders-filter-drawer-backdrop'
          onClick={() => setIsSaveFilterDrawerOpen(false)}
        >
          <aside
            className='orders-filter-drawer'
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h3>Save filter</h3>
              <button
                type='button'
                aria-label='Close save filter panel'
                onClick={() => setIsSaveFilterDrawerOpen(false)}
              >
                x
              </button>
            </header>
            <label className='orders-filter-field'>
              <span>Filter name</span>
              <input
                type='text'
                value={newFilterName}
                onChange={(event) =>
                  setNewFilterName(event.target.value)
                }
                placeholder='My filter'
              />
            </label>
            <div className='orders-filter-icons'>
              <span>Choose icon</span>
              <div className='orders-filter-icons-grid'>
                {filterIconOptions.map((icon, index) => (
                  <button
                    key={`${icon}-${index}`}
                    type='button'
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
            <div className='orders-filter-drawer-list'>
              <span>Your saved filters</span>
              {employeeSavedFilters.length > 0 ? (
                employeeSavedFilters.map((savedFilter) => (
                  <div
                    key={savedFilter.id}
                    className='orders-filter-drawer-item'
                  >
                    <button
                      type='button'
                      onClick={() => applySavedFilter(savedFilter)}
                    >
                      {`${savedFilter.icon} ${savedFilter.name}`}
                    </button>
                    <button
                      type='button'
                      className='orders-filter-delete-button'
                      onClick={() =>
                        removeSavedFilter(savedFilter.id)
                      }
                      aria-label={`Delete ${savedFilter.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                ))
              ) : (
                <small>No filters yet.</small>
              )}
            </div>
            <footer>
              <button
                type='button'
                className='toolbar-filter-button orders-filter-apply'
                onClick={saveCurrentFilter}
                disabled={!canManageSavedFilters}
              >
                Save
              </button>
              <button
                type='button'
                className='toolbar-filter-button'
                onClick={() => setIsSaveFilterDrawerOpen(false)}
              >
                Cancel
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      <div className='orders-table-wrap'>
        <table
          className='orders-table orders-workspace-table'
          style={{ minWidth: tableMinWidth }}
        >
          <thead>
            <tr>
              {visibleColumnKeys.map((columnKey) => (
                <th
                  key={columnKey}
                  className={getOrdersColumnClassName(columnKey)}
                >
                  {getColumnLabel(columnKey, activeTab)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={visibleColumnKeys.length}
                  className='orders-empty'
                >
                  Loading orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumnKeys.length}
                  className='orders-empty'
                >
                  {activeTab === 'orders'
                    ? 'Orders not found.'
                    : 'Sales not found.'}
                </td>
              </tr>
            ) : (
              paginatedOrders.map((sale) => (
                <tr key={sale.id}>
                  {visibleColumnKeys.map((columnKey) => (
                    <td
                      key={`${sale.id}-${columnKey}`}
                      className={getOrdersColumnClassName(columnKey)}
                      data-label={getColumnLabel(columnKey, activeTab)}
                    >
                      {renderOrdersCell(sale, columnKey)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <PaginationPanel
        totalItems={filteredOrders.length}
        page={currentPage}
        pageSize={currentPageSize}
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
      />
      {openStatusSale &&
      statusMenuPosition &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              className='order-status-options order-status-options-portal'
              style={{
                top: statusMenuPosition.top,
                left: statusMenuPosition.left,
              }}
            >
              {getStatusOptions(openStatusSale).map(
                (statusOption) => (
                  <button
                    key={statusOption.key}
                    type='button'
                    disabled={isRepairStatusChangeLockedByStock(
                      openStatusSale,
                      statusOption.key,
                    )}
                    className={
                      statusOption.key === getStatus(openStatusSale)
                        ? 'order-status-option order-status-option-active'
                        : 'order-status-option'
                    }
                    title={
                      isRepairStatusChangeLockedByStock(
                        openStatusSale,
                        statusOption.key,
                      )
                        ? 'Refund client payment for bound products and return them to stock first.'
                        : undefined
                    }
                    onClick={() => {
                      void updateStatus(
                        openStatusSale,
                        statusOption.key,
                      );
                    }}
                  >
                    {statusOption.label}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}

      {paymentSale
        ? (() => {
            const lineItems = getLineItems(paymentSale);
            const paidAmount = getPaidAmount(paymentSale);
            const currentPaymentRemaining = getRemainingPayment(
              paymentSale,
              paidAmount,
              lineItems,
            );
            return (
              <PaymentModal
                sale={paymentSale}
                paymentTargetStatus={paymentTargetStatus}
                printForms={printForms}
                cashboxes={cashboxes}
                selectedCashboxId={selectedCashboxId}
                paymentMethod={paymentMethod}
                amount={paymentAmount}
                paidAmount={paidAmount}
                total={getOrderBaseTotal(paymentSale, lineItems)}
                discount={getDiscount(paymentSale)}
                currentPaymentRemaining={currentPaymentRemaining}
                isRepairTargetStatusBlockedByStock={isRepairStatusChangeLockedByStock(
                  paymentSale,
                  paymentTargetStatus,
                  lineItems,
                )}
                isIssueWithoutPaymentBlocked={isIssueWithoutPaymentBlockedForSale(
                  paymentSale,
                  paymentTargetStatus,
                  lineItems,
                  currentPaymentRemaining,
                )}
                isLoading={isPaymentModalLoading}
                isSaving={isPaymentSaving}
                onCashboxChange={setSelectedCashboxId}
                onPaymentMethodChange={setPaymentMethod}
                onAmountChange={setPaymentAmount}
                onClose={() => setPaymentSale(null)}
                onOpenPrint={() =>
                  openPrintDialog(paymentSale, lineItems, paidAmount)
                }
                onSubmit={acceptPayment}
              />
            );
          })()
        : null}

      {printRequest ? (
        <OrderPrintDialog
          request={printRequest}
          printForms={printForms}
          companySettings={printCompanySettings}
          onClose={() => setPrintRequest(null)}
        />
      ) : null}

      {refundSale ? (
        <RefundModal
          cashboxes={cashboxes}
          selectedCashboxId={selectedRefundCashboxId}
          amount={refundAmount}
          paidAmount={getPaidAmount(refundSale)}
          total={getOrderTotal(refundSale, getLineItems(refundSale))}
          isLoading={isRefundModalLoading}
          isSaving={isRefundSaving}
          onCashboxChange={setSelectedRefundCashboxId}
          onAmountChange={setRefundAmount}
          onClose={() => setRefundSale(null)}
          onSubmit={refundPayment}
        />
      ) : null}

      {returnSale && returnLineItem ? (
        <ReturnLineItemModal
          sale={returnSale}
          item={returnLineItem}
          warehouse={returnWarehouse}
          isLoading={isReturnModalLoading}
          isSaving={isReturnSaving}
          onWarehouseChange={setReturnWarehouse}
          onClose={() => {
            setReturnSale(null);
            setReturnLineItem(null);
          }}
          onSubmit={returnLineItemToStock}
        />
      ) : null}

      {fullReturnSale ? (
        <ReturnSaleModal
          sale={fullReturnSale}
          lineItems={getLineItems(fullReturnSale)}
          cashboxes={cashboxes}
          selectedCashboxId={selectedRefundCashboxId}
          amount={returnRefundAmount}
          warehouse={returnWarehouse}
          paidAmount={getPaidAmount(fullReturnSale)}
          isLoading={isFullReturnModalLoading}
          isSaving={isFullReturnSaving}
          onCashboxChange={setSelectedRefundCashboxId}
          onAmountChange={setReturnRefundAmount}
          onWarehouseChange={setReturnWarehouse}
          onClose={() => setFullReturnSale(null)}
          onSubmit={returnFullSaleToStock}
        />
      ) : null}

      {warningMessage ? (
        <MessageModal
          title='Payment warning'
          message={warningMessage}
          onClose={() => setWarningMessage(null)}
        />
      ) : null}
    </section>
  );
};
