import { CatalogProduct, type CatalogProductDocument } from '../catalog-product/model';
import { Product, type ProductDocument } from '../product/model';
import { Sale, type SaleDocument } from '../sale/model';
import { SupplierOrder, type SupplierOrderDocument } from '../supplier-order/model';
import { WarehouseSettings, type WarehouseSettingsDocument } from '../warehouse-settings/model';
import { coldSalesPurgedExist } from '../archive/yearly-dump';
import {
  addCalendarDays,
  diffCalendarDaysInclusive,
  formatKievDateKey,
  getKievDayStartUtc,
} from './period-utils';

export type WarehouseAgeBucketKey =
  | '0-30'
  | '31-60'
  | '61-90'
  | '90+'
  | 'unknown';

export type WarehouseStockStateFilter =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'reserved';

export type WarehouseReportQuery = {
  warehouseId?: string;
  locationId?: string;
  supplier?: string;
  ageBucket?: string;
  stockState?: string;
  q?: string;
  leadTimeDays?: number | string;
  safetyStockDays?: number | string;
  horizonDays?: number | string;
  demandMultiplier?: number | string;
  includePendingSupplierOrders?: string | boolean;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: string;
  sortDir?: string;
};

type EnrichedStockRecord = {
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

const COMMITTED_OR_CLOSED_SALE_STATUSES = new Set([
  'paid',
  'issued',
  'issuedwithoutrepair',
  'cancelled',
  'returned',
  'clientrejected',
]);

const ACTIVE_SALE_COMMITTED_CHECK = (kind: string, status: string) => {
  const s = String(status ?? '').trim().toLowerCase();
  if (kind === 'sale') return s === 'paid' || s === 'issued';
  return s === 'issued' || s === 'issuedwithoutrepair';
};

const roundMoney = (v: number) => Math.round(v * 100) / 100;
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const round1 = (v: number) => Math.round(v * 10) / 10;

export const normalizeProductNameKey = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

const clampFloat = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const resolveHorizonDays = (value: unknown): 30 | 60 | 90 => {
  const n = Number(value);
  if (n === 60 || n === 90) return n;
  return 30;
};

export const resolveAgeBucket = (
  purchaseDate: Date | string | null | undefined,
  todayKey: string,
): { ageDays: number | null; ageBucket: WarehouseAgeBucketKey } => {
  if (!purchaseDate) {
    return { ageDays: null, ageBucket: 'unknown' };
  }
  const key = formatKievDateKey(purchaseDate);
  if (!key) {
    return { ageDays: null, ageBucket: 'unknown' };
  }
  const days = Math.max(diffCalendarDaysInclusive(key, todayKey) - 1, 0);
  if (days <= 30) return { ageDays: days, ageBucket: '0-30' };
  if (days <= 60) return { ageDays: days, ageBucket: '31-60' };
  if (days <= 90) return { ageDays: days, ageBucket: '61-90' };
  return { ageDays: days, ageBucket: '90+' };
};

const loadWarehouseDataset = async (query: WarehouseReportQuery, now: Date = new Date()) => {
  const todayKey = formatKievDateKey(now);
  const trailStartKey = addCalendarDays(todayKey, -89);
  const trailStartUtc = getKievDayStartUtc(trailStartKey);

  const [
    products,
    sales,
    openSupplierOrders,
    catalogProducts,
    warehouseSettings,
    purgedArchiveExists,
    earliestSale,
  ] = await Promise.all([
    Product.find({ isActive: true })
      .select({
        _id: 1,
        name: 1,
        article: 1,
        serialNumber: 1,
        price: 1,
        quantity: 1,
        reservedQuantity: 1,
        purchasePlace: 1,
        warehouseId: 1,
        locationId: 1,
        supplierOrderId: 1,
        purchaseDate: 1,
      })
      .lean<ProductDocument[]>(),
    Sale.find({
      $or: [
        { status: { $nin: Array.from(COMMITTED_OR_CLOSED_SALE_STATUSES) } },
        { saleDate: { $gte: trailStartUtc } },
        { firstStockCommittedAt: { $gte: trailStartUtc } },
      ],
    })
      .select({
        kind: 1,
        status: 1,
        saleDate: 1,
        firstStockCommittedAt: 1,
        product: 1,
        quantity: 1,
        lineItems: 1,
      })
      .lean<SaleDocument[]>(),
    SupplierOrder.find({
      status: { $nin: ['cancelled', 'unavailable', 'stocked'] },
    })
      .select({
        _id: 1,
        orderBaseId: 1,
        number: 1,
        status: 1,
        deliveryDate: 1,
        items: 1,
      })
      .lean<SupplierOrderDocument[]>(),
    CatalogProduct.find({})
      .select({ _id: 1, name: 1 })
      .lean<CatalogProductDocument[]>(),
    WarehouseSettings.findOne({})
      .select({ warehouses: 1 })
      .lean<WarehouseSettingsDocument | null>(),
    coldSalesPurgedExist(),
    Sale.findOne({})
      .sort({ saleDate: 1 })
      .select({ saleDate: 1 })
      .lean<{ saleDate?: Date } | null>(),
  ]);

  const warehouseNameById = new Map<string, string>();
  const locationNameById = new Map<string, string>();
  for (const wh of warehouseSettings?.warehouses ?? []) {
    warehouseNameById.set(wh.id, wh.name);
    for (const loc of wh.locations ?? []) {
      locationNameById.set(`${wh.id}::${loc.id}`, loc.name);
      locationNameById.set(loc.id, loc.name);
    }
  }

  const productById = new Map(
    products.map((p) => [p._id.toString(), p]),
  );
  const catalogNameById = new Map(
    catalogProducts.map((cp) => [cp._id.toString(), normalizeProductNameKey(cp.name)]),
  );
  const serialToProductId = new Map<string, string>();
  for (const p of products) {
    const serial = String(p.serialNumber ?? '').trim().toUpperCase();
    if (serial) {
      serialToProductId.set(serial, p._id.toString());
    }
  }

  // Build open reservations bound on uncommitted active sales + 90-day observed product demand.
  const orderReservedByProductId = new Map<string, number>();
  const demandByNameKey = new Map<string, { qty: number; days: Set<string> }>();

  for (const sale of sales) {
    const statusLower = String(sale.status ?? '').trim().toLowerCase();
    const kind = sale.kind === 'sale' ? 'sale' : 'repair';
    const isCommitted = ACTIVE_SALE_COMMITTED_CHECK(kind, statusLower);
    const isClosedNonCommitted = COMMITTED_OR_CLOSED_SALE_STATUSES.has(statusLower);
    const items = Array.isArray(sale.lineItems) ? sale.lineItems : [];

    if (!isClosedNonCommitted && !isCommitted) {
      if (items.length > 0) {
        for (const item of items) {
          if (item.kind !== 'product') continue;
          const directPid = item.productId ? item.productId.toString() : '';
          if (directPid) {
            orderReservedByProductId.set(
              directPid,
              (orderReservedByProductId.get(directPid) ?? 0) +
                Math.max(Number(item.quantity ?? 1), 1),
            );
          } else {
            for (const serial of item.serialNumbers ?? []) {
              const pid = serialToProductId.get(String(serial ?? '').trim().toUpperCase());
              if (pid) {
                orderReservedByProductId.set(
                  pid,
                  (orderReservedByProductId.get(pid) ?? 0) + 1,
                );
              }
            }
          }
        }
      } else if (sale.product) {
        const pid = sale.product.toString();
        orderReservedByProductId.set(
          pid,
          (orderReservedByProductId.get(pid) ?? 0) +
            Math.max(Number(sale.quantity ?? 1), 1),
        );
      }
      continue;
    }

    if (isCommitted) {
      const eventDate =
        (sale as { firstStockCommittedAt?: Date | null }).firstStockCommittedAt ??
        sale.saleDate;
      const dateKey = formatKievDateKey(eventDate);
      if (!dateKey || dateKey < trailStartKey || dateKey > todayKey) continue;

      for (const item of items) {
        if (item.kind !== 'product') continue;
        const qty = Math.max(Number(item.quantity ?? 0), 0);
        if (qty <= 0) continue;

        const pid = item.productId ? item.productId.toString() : '';
        const cid = item.catalogProductId ? item.catalogProductId.toString() : '';
        const linkedProd = pid ? productById.get(pid) : undefined;
        const nameKey =
          (cid ? catalogNameById.get(cid) : undefined) ??
          normalizeProductNameKey(linkedProd?.name ?? item.name);
        if (!nameKey) continue;

        const entry = demandByNameKey.get(nameKey) ?? {
          qty: 0,
          days: new Set<string>(),
        };
        entry.qty += qty;
        entry.days.add(dateKey);
        demandByNameKey.set(nameKey, entry);
      }
    }
  }

  // Enrich stock items.
  const allRecords: EnrichedStockRecord[] = products.map((product) => {
    const pid = product._id.toString();
    const quantity = Math.max(Number(product.quantity ?? 0), 0);
    const manualReserved = Math.max(Number(product.reservedQuantity ?? 0), 0);
    const orderReserved = orderReservedByProductId.get(pid) ?? 0;
    const reservedQuantity = Math.min(quantity, manualReserved + orderReserved);
    const availableQuantity = Math.max(quantity - reservedQuantity, 0);
    const price = Math.max(Number(product.price ?? 0), 0);
    const valuation = roundMoney(price * quantity);
    const availableValuation = roundMoney(price * availableQuantity);
    const { ageDays, ageBucket } = resolveAgeBucket(product.purchaseDate, todayKey);
    const warehouseId = String(product.warehouseId ?? '').trim();
    const locationId = String(product.locationId ?? '').trim();
    const warehouseName =
      (warehouseId ? warehouseNameById.get(warehouseId) : undefined) ||
      warehouseId ||
      'Unassigned warehouse';
    const locationName =
      (locationId
        ? locationNameById.get(`${warehouseId}::${locationId}`) ??
          locationNameById.get(locationId)
        : undefined) ||
      locationId ||
      'Unassigned location';

    const stockState: EnrichedStockRecord['stockState'] =
      availableQuantity <= 0 && reservedQuantity > 0
        ? 'reserved'
        : availableQuantity <= 0
          ? 'out_of_stock'
          : availableQuantity <= 2
            ? 'low_stock'
            : 'in_stock';

    return {
      id: pid,
      name: product.name,
      nameKey: normalizeProductNameKey(product.name),
      article: product.article ?? '',
      serialNumber: product.serialNumber ?? '',
      price,
      quantity,
      reservedQuantity,
      manualReservedQuantity: manualReserved,
      orderReservedQuantity: orderReserved,
      availableQuantity,
      valuation,
      availableValuation,
      supplier: String(product.purchasePlace ?? '').trim() || 'Unspecified supplier',
      warehouseId,
      warehouseName,
      locationId,
      locationName,
      supplierOrderId: String(product.supplierOrderId ?? '').trim(),
      purchaseDate: product.purchaseDate
        ? new Date(product.purchaseDate).toISOString()
        : null,
      ageDays,
      ageBucket,
      stockState,
    };
  });

  // Compute incoming pending supplier quantities per product nameKey.
  const pendingByNameKey = new Map<
    string,
    { pendingQty: number; overdueQty: number; earliestEta: string | null }
  >();
  for (const order of openSupplierOrders) {
    const etaKey = formatKievDateKey(order.deliveryDate);
    const isOverdue =
      order.status === 'overdue' || (Boolean(etaKey) && etaKey < todayKey);
    for (const item of order.items ?? []) {
      if (item.receiptStatus !== 'new' && item.receiptStatus !== 'approved') {
        continue;
      }
      const cid = item.catalogProductId ? item.catalogProductId.toString() : '';
      const nameKey =
        (cid ? catalogNameById.get(cid) : undefined) ??
        normalizeProductNameKey(item.productName);
      if (!nameKey) continue;
      const qty = Math.max(Number(item.quantity ?? 0), 0);
      if (qty <= 0) continue;

      const cur = pendingByNameKey.get(nameKey) ?? {
        pendingQty: 0,
        overdueQty: 0,
        earliestEta: null,
      };
      cur.pendingQty += qty;
      if (isOverdue) cur.overdueQty += qty;
      if (etaKey && (!cur.earliestEta || etaKey < cur.earliestEta)) {
        cur.earliestEta = etaKey;
      }
      pendingByNameKey.set(nameKey, cur);
    }
  }

  // Apply non-aging structural filters first so aging bucket counts remain interactive.
  const warehouseFilter = String(query.warehouseId ?? '').trim();
  const locationFilter = String(query.locationId ?? '').trim();
  const supplierFilter = String(query.supplier ?? '').trim();
  const ageBucketFilter = String(query.ageBucket ?? '').trim() as WarehouseAgeBucketKey | '';
  const stockStateFilter = String(query.stockState ?? 'all').trim() as WarehouseStockStateFilter;
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const matchesBaseFilters = (row: EnrichedStockRecord) => {
    if (warehouseFilter && row.warehouseId !== warehouseFilter) return false;
    if (locationFilter && row.locationId !== locationFilter) return false;
    if (supplierFilter && row.supplier !== supplierFilter) return false;
    if (stockStateFilter && stockStateFilter !== 'all') {
      if (stockStateFilter === 'reserved') {
        if (row.reservedQuantity <= 0) return false;
      } else if (row.stockState !== stockStateFilter) {
        return false;
      }
    }
    if (searchQuery) {
      const haystack = `${row.name} ${row.article} ${row.serialNumber} ${row.supplier}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }
    return true;
  };

  const baseRecords = allRecords.filter(matchesBaseFilters);
  const filteredRecords = baseRecords.filter((row) =>
    ageBucketFilter ? row.ageBucket === ageBucketFilter : true,
  );

  // History coverage metadata
  const earliestSaleKey = earliestSale?.saleDate
    ? formatKievDateKey(earliestSale.saleDate)
    : null;
  const observedHistoryDays = earliestSaleKey
    ? Math.min(Math.max(diffCalendarDaysInclusive(earliestSaleKey, todayKey), 0), 90)
    : 0;

  return {
    todayKey,
    trailStartKey,
    allRecords,
    baseRecords,
    filteredRecords,
    demandByNameKey,
    pendingByNameKey,
    observedHistoryDays,
    earliestLiveSaleDate: earliestSale?.saleDate
      ? new Date(earliestSale.saleDate).toISOString()
      : null,
    purgedArchiveExists,
    warehouseOptions: Array.from(
      new Map(
        allRecords
          .filter((r) => r.warehouseId)
          .map((r) => [r.warehouseId, r.warehouseName]),
      ).entries(),
    ).map(([id, name]) => ({ id, name })),
    supplierOptions: Array.from(new Set(allRecords.map((r) => r.supplier))).sort(),
  };
};

export const getWarehouseReport = async (
  query: WarehouseReportQuery = {},
  now: Date = new Date(),
) => {
  const leadTimeDays = clampInt(query.leadTimeDays, 14, 0, 365);
  const safetyStockDays = clampInt(query.safetyStockDays, 7, 0, 365);
  const horizonDays = resolveHorizonDays(query.horizonDays);
  const demandMultiplier = clampFloat(query.demandMultiplier, 1, 0, 10);
  const includePendingSupplierOrders =
    query.includePendingSupplierOrders === false ||
    String(query.includePendingSupplierOrders).toLowerCase() === 'false'
      ? false
      : true;

  const {
    todayKey,
    trailStartKey,
    baseRecords,
    filteredRecords,
    demandByNameKey,
    pendingByNameKey,
    observedHistoryDays,
    earliestLiveSaleDate,
    purgedArchiveExists,
    warehouseOptions,
    supplierOptions,
  } = await loadWarehouseDataset(query, now);

  // KPI summary over filtered records
  let totalQuantity = 0;
  let reservedQuantity = 0;
  let manualReservedQuantity = 0;
  let orderReservedQuantity = 0;
  let availableQuantity = 0;
  let purchaseValuation = 0;
  let availableValuation = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  let unknownAgeOnHandCount = 0;
  let unknownAgeUnits = 0;

  for (const row of filteredRecords) {
    totalQuantity += row.quantity;
    reservedQuantity += row.reservedQuantity;
    manualReservedQuantity += row.manualReservedQuantity;
    orderReservedQuantity += row.orderReservedQuantity;
    availableQuantity += row.availableQuantity;
    purchaseValuation += row.valuation;
    availableValuation += row.availableValuation;
    if (row.availableQuantity <= 0) outOfStockCount += 1;
    else if (row.availableQuantity <= 2) lowStockCount += 1;
    if (row.quantity > 0 && row.ageBucket === 'unknown') {
      unknownAgeOnHandCount += 1;
      unknownAgeUnits += row.quantity;
    }
  }

  // Aging buckets across baseRecords (on-hand quantity > 0)
  const bucketOrder: WarehouseAgeBucketKey[] = ['0-30', '31-60', '61-90', '90+', 'unknown'];
  const bucketMap = new Map<
    WarehouseAgeBucketKey,
    { skuCount: number; quantity: number; reservedQuantity: number; availableQuantity: number; valuation: number }
  >(
    bucketOrder.map((bucket) => [
      bucket,
      { skuCount: 0, quantity: 0, reservedQuantity: 0, availableQuantity: 0, valuation: 0 },
    ]),
  );

  for (const row of baseRecords) {
    if (row.quantity <= 0) continue;
    const b = bucketMap.get(row.ageBucket)!;
    b.skuCount += 1;
    b.quantity += row.quantity;
    b.reservedQuantity += row.reservedQuantity;
    b.availableQuantity += row.availableQuantity;
    b.valuation += row.valuation;
  }

  const agingBuckets = bucketOrder.map((bucket) => {
    const b = bucketMap.get(bucket)!;
    return {
      bucket,
      skuCount: b.skuCount,
      quantity: b.quantity,
      reservedQuantity: b.reservedQuantity,
      availableQuantity: b.availableQuantity,
      valuation: roundMoney(b.valuation),
    };
  });

  // Distributions by supplier & location over filtered records
  const supplierDistMap = new Map<
    string,
    { key: string; label: string; skuCount: number; quantity: number; reservedQuantity: number; availableQuantity: number; valuation: number }
  >();
  const locationDistMap = new Map<
    string,
    {
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
    }
  >();

  for (const row of filteredRecords) {
    const supEntry = supplierDistMap.get(row.supplier) ?? {
      key: row.supplier,
      label: row.supplier,
      skuCount: 0,
      quantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
      valuation: 0,
    };
    supEntry.skuCount += 1;
    supEntry.quantity += row.quantity;
    supEntry.reservedQuantity += row.reservedQuantity;
    supEntry.availableQuantity += row.availableQuantity;
    supEntry.valuation += row.valuation;
    supplierDistMap.set(row.supplier, supEntry);

    const locKey = `${row.warehouseId || 'none'}::${row.locationId || 'none'}`;
    const locEntry = locationDistMap.get(locKey) ?? {
      key: locKey,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      locationId: row.locationId,
      locationName: row.locationName,
      label: `${row.warehouseName} / ${row.locationName}`,
      skuCount: 0,
      quantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
      valuation: 0,
    };
    locEntry.skuCount += 1;
    locEntry.quantity += row.quantity;
    locEntry.reservedQuantity += row.reservedQuantity;
    locEntry.availableQuantity += row.availableQuantity;
    locEntry.valuation += row.valuation;
    locationDistMap.set(locKey, locEntry);
  }

  // Group filtered records by product model (nameKey) for demand, coverage, reorder & scenario projection
  const skuGroupMap = new Map<
    string,
    {
      nameKey: string;
      name: string;
      supplier: string;
      onHandQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
      valuation: number;
      unitPrices: number[];
    }
  >();

  for (const row of filteredRecords) {
    const group = skuGroupMap.get(row.nameKey) ?? {
      nameKey: row.nameKey,
      name: row.name,
      supplier: row.supplier,
      onHandQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
      valuation: 0,
      unitPrices: [],
    };
    group.onHandQuantity += row.quantity;
    group.reservedQuantity += row.reservedQuantity;
    group.availableQuantity += row.availableQuantity;
    group.valuation += row.valuation;
    if (row.price > 0) group.unitPrices.push(row.price);
    skuGroupMap.set(row.nameKey, group);
  }

  const reorderBufferDays = leadTimeDays + safetyStockDays;
  const demandAndSuggestions = Array.from(skuGroupMap.values())
    .map((group) => {
      const demandInfo = demandByNameKey.get(group.nameKey);
      const observedDemand90d = demandInfo?.qty ?? 0;
      const activeDemandDays = demandInfo?.days.size ?? 0;
      const observedDailyDemand = round4(observedDemand90d / 90);
      const projectedDailyDemand = round4(observedDailyDemand * demandMultiplier);

      const pendingInfo = pendingByNameKey.get(group.nameKey);
      const pendingSupplierQuantity = pendingInfo?.pendingQty ?? 0;
      const overdueSupplierQuantity = pendingInfo?.overdueQty ?? 0;
      const effectiveIncoming = includePendingSupplierOrders
        ? pendingSupplierQuantity
        : 0;
      const netSupplyPosition = group.availableQuantity + effectiveIncoming;

      const estimatedCoverageDays =
        projectedDailyDemand > 0
          ? round1(group.availableQuantity / projectedDailyDemand)
          : null;
      const estimatedCoverageWithPendingDays =
        projectedDailyDemand > 0
          ? round1(netSupplyPosition / projectedDailyDemand)
          : null;

      const targetBufferUnits = roundMoney(projectedDailyDemand * reorderBufferDays);
      const reorderSuggestedQty = Math.ceil(
        Math.max(targetBufferUnits - netSupplyPosition, 0),
      );
      const horizonProjectedDemand = roundMoney(projectedDailyDemand * horizonDays);
      const horizonProjectedEndingAvailable = roundMoney(
        netSupplyPosition - horizonProjectedDemand,
      );
      const horizonProjectedShortfall = Math.ceil(
        Math.max(horizonProjectedDemand - netSupplyPosition, 0),
      );
      const avgUnitCost =
        group.unitPrices.length > 0
          ? roundMoney(
              group.unitPrices.reduce((s, p) => s + p, 0) / group.unitPrices.length,
            )
          : 0;

      const demandPattern: 'steady' | 'sparse' | 'zero' =
        observedDemand90d === 0
          ? 'zero'
          : activeDemandDays <= 3
            ? 'sparse'
            : 'steady';

      return {
        nameKey: group.nameKey,
        name: group.name,
        supplier: group.supplier,
        onHandQuantity: group.onHandQuantity,
        reservedQuantity: group.reservedQuantity,
        availableQuantity: group.availableQuantity,
        valuation: roundMoney(group.valuation),
        avgUnitCost,
        pendingSupplierQuantity,
        overdueSupplierQuantity,
        earliestExpectedDelivery: pendingInfo?.earliestEta ?? null,
        observedDemand90d,
        activeDemandDays,
        observedDailyDemand,
        projectedDailyDemand,
        demandPattern,
        estimatedCoverageDays,
        estimatedCoverageWithPendingDays,
        targetBufferUnits,
        reorderSuggestedQty,
        estimatedReorderCost: roundMoney(reorderSuggestedQty * avgUnitCost),
        horizonProjectedDemand,
        horizonProjectedEndingAvailable,
        horizonProjectedShortfall,
        needsReorder: reorderSuggestedQty > 0,
      };
    })
    .sort((a, b) => {
      if (b.reorderSuggestedQty !== a.reorderSuggestedQty) {
        return b.reorderSuggestedQty - a.reorderSuggestedQty;
      }
      return b.observedDemand90d - a.observedDemand90d;
    });

  const warnings: string[] = [];
  const warningItems: Array<{ code: string; count?: number; units?: number }> = [];
  if (purgedArchiveExists) {
    warnings.push(
      'Cold yearly archive purges exist; trailing demand only reflects live persisted sales.',
    );
    warningItems.push({ code: 'coldArchiveDemand' });
  }
  if (observedHistoryDays < 90) {
    warnings.push(
      `Only ${observedHistoryDays} day(s) of live sales history available in the 90-day observation window.`,
    );
    warningItems.push({ code: 'shortSalesHistory', count: observedHistoryDays });
  }
  if (unknownAgeOnHandCount > 0) {
    warnings.push(
      `${unknownAgeOnHandCount} on-hand record(s) (${unknownAgeUnits} unit(s)) have no purchase date (Unknown age).`,
    );
    warningItems.push({
      code: 'unknownAgeOnHand',
      count: unknownAgeOnHandCount,
      units: unknownAgeUnits,
    });
  }

  return {
    generatedAt: now.toISOString(),
    timeZone: 'Europe/Kiev',
    filtersApplied: {
      warehouseId: query.warehouseId ?? '',
      locationId: query.locationId ?? '',
      supplier: query.supplier ?? '',
      ageBucket: query.ageBucket ?? '',
      stockState: query.stockState ?? 'all',
      q: query.q ?? '',
    },
    assumptions: {
      leadTimeDays,
      safetyStockDays,
      horizonDays,
      demandMultiplier,
      includePendingSupplierOrders,
    },
    summary: {
      skuCount: filteredRecords.length,
      productGroupCount: demandAndSuggestions.length,
      totalQuantity,
      reservedQuantity,
      manualReservedQuantity,
      orderReservedQuantity,
      availableQuantity,
      purchaseValuation: roundMoney(purchaseValuation),
      availableValuation: roundMoney(availableValuation),
      outOfStockCount,
      lowStockCount,
      unknownAgeOnHandCount,
      unknownAgeUnits,
      totalObservedDemand90d: demandAndSuggestions.reduce(
        (sum, r) => sum + r.observedDemand90d,
        0,
      ),
      pendingSupplierUnits: demandAndSuggestions.reduce(
        (sum, r) => sum + r.pendingSupplierQuantity,
        0,
      ),
      reorderSkuCount: demandAndSuggestions.filter((r) => r.needsReorder).length,
      totalSuggestedReorderUnits: demandAndSuggestions.reduce(
        (sum, r) => sum + r.reorderSuggestedQty,
        0,
      ),
      totalEstimatedReorderCost: roundMoney(
        demandAndSuggestions.reduce((sum, r) => sum + r.estimatedReorderCost, 0),
      ),
    },
    agingBuckets,
    distributions: {
      bySupplier: Array.from(supplierDistMap.values())
        .map((r) => ({ ...r, valuation: roundMoney(r.valuation) }))
        .sort((a, b) => b.valuation - a.valuation),
      byLocation: Array.from(locationDistMap.values())
        .map((r) => ({ ...r, valuation: roundMoney(r.valuation) }))
        .sort((a, b) => b.valuation - a.valuation),
    },
    demandAndSuggestions,
    forecast: {
      isEstimate: true,
      horizonDays,
      observationWindow: {
        dateFrom: trailStartKey,
        dateTo: todayKey,
        windowDays: 90,
        observedHistoryDays,
        earliestLiveSaleDate,
      },
      summary: {
        projectedDemandUnits: roundMoney(
          demandAndSuggestions.reduce((s, r) => s + r.horizonProjectedDemand, 0),
        ),
        projectedShortfallUnits: demandAndSuggestions.reduce(
          (s, r) => s + r.horizonProjectedShortfall,
          0,
        ),
        skusAtRiskCount: demandAndSuggestions.filter(
          (r) => r.horizonProjectedShortfall > 0,
        ).length,
      },
    },
    filterOptions: {
      warehouses: warehouseOptions,
      suppliers: supplierOptions,
    },
    coverage: {
      coldSalesPurgedExist: purgedArchiveExists,
      observedHistoryDays,
      historyWindowDays: 90,
      earliestLiveSaleDate,
      unknownAgeOnHandCount,
      warnings,
      warningItems,
    },
  };
};

export const getWarehouseReportDetails = async (
  query: WarehouseReportQuery = {},
  now: Date = new Date(),
) => {
  const { filteredRecords } = await loadWarehouseDataset(query, now);
  const page = clampInt(query.page, 1, 1, 10000);
  const pageSize = clampInt(query.pageSize, 25, 1, 200);
  const sortBy = String(query.sortBy ?? 'valuation').trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 1 : -1;

  const sorted = [...filteredRecords].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name) * sortDir;
      case 'quantity':
        return (a.quantity - b.quantity) * sortDir;
      case 'availableQuantity':
        return (a.availableQuantity - b.availableQuantity) * sortDir;
      case 'reservedQuantity':
        return (a.reservedQuantity - b.reservedQuantity) * sortDir;
      case 'price':
        return (a.price - b.price) * sortDir;
      case 'ageDays': {
        const av = a.ageDays ?? -1;
        const bv = b.ageDays ?? -1;
        return (av - bv) * sortDir;
      }
      case 'supplier':
        return a.supplier.localeCompare(b.supplier) * sortDir;
      case 'valuation':
      default:
        return (a.valuation - b.valuation) * sortDir;
    }
  });

  const total = sorted.length;
  const skip = (page - 1) * pageSize;
  const items = sorted.slice(skip, skip + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totals: {
      totalQuantity: sorted.reduce((s, r) => s + r.quantity, 0),
      reservedQuantity: sorted.reduce((s, r) => s + r.reservedQuantity, 0),
      availableQuantity: sorted.reduce((s, r) => s + r.availableQuantity, 0),
      valuation: roundMoney(sorted.reduce((s, r) => s + r.valuation, 0)),
    },
  };
};
