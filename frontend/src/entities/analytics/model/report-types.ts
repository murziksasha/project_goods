export type BoundedReportPeriod =
  | 'whole'
  | 'day'
  | 'week'
  | 'month'
  | 'year'
  | 'last7'
  | 'last30'
  | 'custom';

export type WarehouseAgeBucketKey = '0-30' | '31-60' | '61-90' | '90+' | 'unknown';

export type WarehouseReportParams = {
  warehouseId?: string;
  locationId?: string;
  supplier?: string;
  ageBucket?: string;
  stockState?: string;
  q?: string;
  leadTimeDays?: number;
  safetyStockDays?: number;
  horizonDays?: 30 | 60 | 90;
  demandMultiplier?: number;
  includePendingSupplierOrders?: boolean;
};

export type WarehouseReportDetailsParams = WarehouseReportParams & {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export type WarehouseReportResponse = {
  generatedAt: string;
  timeZone: string;
  filtersApplied: Record<string, string>;
  assumptions: {
    leadTimeDays: number;
    safetyStockDays: number;
    horizonDays: 30 | 60 | 90;
    demandMultiplier: number;
    includePendingSupplierOrders: boolean;
  };
  summary: {
    skuCount: number;
    productGroupCount: number;
    totalQuantity: number;
    reservedQuantity: number;
    manualReservedQuantity: number;
    orderReservedQuantity: number;
    availableQuantity: number;
    purchaseValuation: number;
    availableValuation: number;
    outOfStockCount: number;
    lowStockCount: number;
    unknownAgeOnHandCount: number;
    unknownAgeUnits: number;
    totalObservedDemand90d: number;
    pendingSupplierUnits: number;
    reorderSkuCount: number;
    totalSuggestedReorderUnits: number;
    totalEstimatedReorderCost: number;
  };
  agingBuckets: Array<{
    bucket: WarehouseAgeBucketKey;
    skuCount: number;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    valuation: number;
  }>;
  distributions: {
    bySupplier: Array<{
      key: string;
      label: string;
      skuCount: number;
      quantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      valuation: number;
    }>;
    byLocation: Array<{
      key: string;
      warehouseId: string;
      warehouseName: string;
      locationId: string;
      locationName: string;
      label: string;
      skuCount: number;
      quantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      valuation: number;
    }>;
  };
  demandAndSuggestions: Array<{
    nameKey: string;
    name: string;
    supplier: string;
    onHandQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    valuation: number;
    avgUnitCost: number;
    pendingSupplierQuantity: number;
    overdueSupplierQuantity: number;
    earliestExpectedDelivery: string | null;
    observedDemand90d: number;
    activeDemandDays: number;
    observedDailyDemand: number;
    projectedDailyDemand: number;
    demandPattern: 'steady' | 'sparse' | 'zero';
    estimatedCoverageDays: number | null;
    estimatedCoverageWithPendingDays: number | null;
    targetBufferUnits: number;
    reorderSuggestedQty: number;
    estimatedReorderCost: number;
    horizonProjectedDemand: number;
    horizonProjectedEndingAvailable: number;
    horizonProjectedShortfall: number;
    needsReorder: boolean;
  }>;
  forecast: {
    isEstimate: boolean;
    horizonDays: 30 | 60 | 90;
    observationWindow: {
      dateFrom: string;
      dateTo: string;
      windowDays: number;
      observedHistoryDays: number;
      earliestLiveSaleDate: string | null;
    };
    summary: {
      projectedDemandUnits: number;
      projectedShortfallUnits: number;
      skusAtRiskCount: number;
    };
  };
  filterOptions: {
    warehouses: Array<{ id: string; name: string }>;
    suppliers: string[];
  };
  coverage: {
    coldSalesPurgedExist: boolean;
    observedHistoryDays: number;
    historyWindowDays: number;
    earliestLiveSaleDate: string | null;
    unknownAgeOnHandCount: number;
    warnings: string[];
  };
};

export type WarehouseDetailRow = {
  id: string;
  name: string;
  nameKey: string;
  article: string;
  serialNumber: string;
  price: number;
  quantity: number;
  reservedQuantity: number;
  manualReservedQuantity: number;
  orderReservedQuantity: number;
  availableQuantity: number;
  valuation: number;
  availableValuation: number;
  supplier: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  supplierOrderId: string;
  purchaseDate: string | null;
  ageDays: number | null;
  ageBucket: WarehouseAgeBucketKey;
  stockState: 'in_stock' | 'low_stock' | 'out_of_stock' | 'reserved';
};

export type WarehouseReportDetailsResponse = {
  items: WarehouseDetailRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: {
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    valuation: number;
  };
};

export type OrdersReportParams = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  masterId?: string;
  unassignedOnly?: boolean;
  openAgeBucket?: string;
  lineKind?: 'all' | 'product' | 'service';
  paymentMethod?: string;
  supplierId?: string;
  overdueOnly?: boolean;
  q?: string;
};

export type OrdersReportDetailsParams = OrdersReportParams & {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export type OrdersRepairsReportResponse = {
  generatedAt: string;
  timeZone: string;
  period: { key: string; dateFrom: string | null; dateTo: string | null };
  previousPeriod: { dateFrom: string | null; dateTo: string | null } | null;
  summary: {
    openCount: number;
    unassignedOpenCount: number;
    intakeCount: number;
    trackedCompletedCount: number;
    untrackedCompletedCount: number;
    totalCompletedCount: number;
    avgTurnaroundHours: number | null;
    medianTurnaroundHours: number | null;
  };
  comparison: {
    intakeCountPrev: number;
    intakeDeltaPct: number | null;
    completedCountPrev: number;
    completedDeltaPct: number | null;
    avgTurnaroundHoursPrev: number | null;
  } | null;
  byStatus: Array<{ status: string; count: number }>;
  byTechnician: Array<{
    technicianId: string | null;
    name: string;
    openCount: number;
    completedInPeriod: number;
  }>;
  openAgingBuckets: Array<{ bucket: string; count: number }>;
  completionTrend: Array<{
    dateKey: string;
    completedCount: number;
    avgTurnaroundHours: number | null;
  }>;
  turnaroundCoverage: {
    trackedCount: number;
    untrackedCount: number;
    totalClosedCount: number;
    coveragePct: number;
    available: boolean;
    warning: string | null;
    warningCode?: string | null;
  };
  coverage: {
    coldSalesPurgedExist: boolean;
    warnings: string[];
    warningItems?: Array<{ code: string; count?: number }>;
  };
};

export type OrdersRepairDetailRow = {
  id: string;
  recordNumber: string | null;
  saleDate: string;
  status: string;
  clientName: string;
  deviceName: string;
  serialNumber: string;
  technicianName: string;
  technicianId: string | null;
  isOpen: boolean;
  ageDays: number | null;
  ageBucket: string | null;
  completedAt: string | null;
  turnaroundHours: number | null;
  total: number;
};

export type OrdersSalesReportResponse = {
  generatedAt: string;
  timeZone: string;
  period: { key: string; dateFrom: string | null; dateTo: string | null };
  previousPeriod: { dateFrom: string | null; dateTo: string | null } | null;
  summary: {
    ordersCount: number;
    unitsSold: number;
    grossRevenue: number;
    discountAmount: number;
    netRevenue: number;
    collectedAmount: number;
    aov: number;
    returnsCount: number;
    returnedUnits: number;
    returnedAmount: number;
    refundedAmount: number;
  };
  comparison: {
    netRevenuePrev: number;
    netRevenueDeltaPct: number | null;
    ordersCountPrev: number;
    ordersCountDeltaPct: number | null;
    unitsSoldPrev: number;
    unitsSoldDeltaPct: number | null;
    aovPrev: number;
    aovDeltaPct: number | null;
    returnsAmountPrev: number;
  } | null;
  mix: {
    productRevenue: number;
    serviceRevenue: number;
    productUnits: number;
    serviceUnits: number;
    productSharePct: number;
    serviceSharePct: number;
  };
  byStatus: Array<{ status: string; count: number; netRevenue: number }>;
  topItems: Array<{
    key: string;
    name: string;
    kind: 'product' | 'service';
    units: number;
    revenue: number;
    knownCost?: number;
    unknownCostCount?: number;
  }>;
  trend: Array<{
    dateKey: string;
    revenue: number;
    ordersCount: number;
    units: number;
    returnsAmount: number;
  }>;
  coverage: {
    coldSalesPurgedExist: boolean;
    warnings: string[];
    warningItems?: Array<{ code: string; count?: number }>;
  };
};

export type OrdersSaleDetailRow = {
  id: string;
  recordNumber: string | null;
  saleDate: string;
  status: string;
  clientName: string;
  units: number;
  grossTotal: number;
  discountTotal: number;
  netTotal: number;
  paidAmount: number;
  returnCount: number;
  isRapidSale: boolean;
};

export type OrdersProcurementReportResponse = {
  generatedAt: string;
  timeZone: string;
  period: { key: string; dateFrom: string | null; dateTo: string | null };
  previousPeriod: { dateFrom: string | null; dateTo: string | null } | null;
  summary: {
    ordersCount: number;
    orderedUnits: number;
    receivedUnits: number;
    cancelledUnits: number;
    pendingUnits: number;
    totalSpend: number;
    paidAmount: number;
    outstandingAmount: number;
    overdueOrdersCount: number;
    overduePendingUnits: number;
  };
  comparison: {
    totalSpendPrev: number;
    totalSpendDeltaPct: number | null;
    ordersCountPrev: number;
    ordersCountDeltaPct: number | null;
    orderedUnitsPrev: number;
    orderedUnitsDeltaPct: number | null;
    receivedUnitsPrev: number;
  } | null;
  receiptPerformance: {
    trackedItemsCount: number;
    untrackedLegacyItemsCount: number;
    totalReceivedItemsCount: number;
    coveragePct: number;
    onTimeCount: number;
    lateCount: number;
    onTimeRatePct: number | null;
    avgReceiptLeadDays: number | null;
    available: boolean;
  };
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    ordersCount: number;
    orderedUnits: number;
    receivedUnits: number;
    totalSpend: number;
    paidAmount: number;
    outstandingAmount: number;
    overdueCount: number;
    avgReceiptLeadDays: number | null;
  }>;
  byProduct: Array<{
    key: string;
    productName: string;
    catalogProductId: string | null;
    ordersCount: number;
    orderedUnits: number;
    receivedUnits: number;
    totalSpend: number;
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    latestPrice: number;
    priceVariationPct: number;
  }>;
  trend: Array<{
    dateKey: string;
    spend: number;
    paid: number;
    ordersCount: number;
    orderedUnits: number;
    receivedUnits: number;
  }>;
  supplierOptions: Array<{ id: string; name: string }>;
  coverage: {
    warnings: string[];
    warningItems?: Array<{ code: string; count?: number }>;
  };
};

export type OrdersProcurementDetailRow = {
  id: string;
  displayNumber: string;
  orderBaseId: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  deliveryDate: string;
  status: string;
  paymentStatus: string;
  receiptStatus: string;
  isOverdue: boolean;
  orderedUnits: number;
  receivedUnits: number;
  total: number;
  paid: number;
  outstanding: number;
  stockedAt: string | null;
};

export type PaginatedDetailsResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
