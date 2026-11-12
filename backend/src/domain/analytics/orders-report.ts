import { Sale, type SaleDocument } from '../sale/model';
import { Supplier } from '../supplier/model';
import { SupplierOrder, type SupplierOrderDocument } from '../supplier-order/model';
import { coldSalesPurgedExist } from '../archive/yearly-dump';
import { getSaleDocumentTotal } from '../../shared/lib/saleTotals';
import { resolveLineItemEffectiveCost, type CostableSaleLineItem, type ReturnEventValue, type StatusTransitionValue } from '../sale/costing';
import {
  formatKievDateKey,
  isDateKeyInsideRange,
  listCalendarDateKeys,
  resolveBoundedPeriodWithPrevious,
  diffCalendarDaysInclusive,
} from './period-utils';

const roundMoney = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

const OPEN_REPAIR_CLOSED_STATUSES = new Set([
  'issued',
  'issuedwithoutrepair',
  'cancelled',
  'returned',
  'clientrejected',
]);

const REPAIR_COMPLETION_STATUSES = new Set([
  'completed',
  'issued',
  'issuedwithoutrepair',
]);

const calcDiscountTotal = (
  gross: number,
  discount?: { mode?: string; value?: number } | null,
) => {
  const val = Number(discount?.value ?? 0);
  if (!Number.isFinite(val) || val <= 0 || gross <= 0) return 0;
  if (discount?.mode === 'amount') return Math.min(roundMoney(val), gross);
  return Math.min(roundMoney((gross * val) / 100), gross);
};

const calcPctDelta = (current: number, previous: number): number | null => {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return round1(((current - previous) / Math.abs(previous)) * 100);
};

// -------------------- 1. ORDERS: REPAIRS --------------------

export type RepairsReportQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  masterId?: string;
  unassignedOnly?: string | boolean;
  openAgeBucket?: string;
  q?: string;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: string;
  sortDir?: string;
};

type RepairCompletionResolution = {
  isCompleted: boolean;
  completedAt: Date | null;
  completedDateKey: string;
  turnaroundHours: number | null;
  hasStructuredTimestamp: boolean;
};

const resolveStructuredRepairCompletion = (
  sale: SaleDocument,
): RepairCompletionResolution => {
  const saleAny = sale as unknown as {
    completedAt?: Date | null;
    statusTransitions?: StatusTransitionValue[];
  };
  const statusLower = String(sale.status ?? '').trim().toLowerCase();
  const isCompletedStatus = REPAIR_COMPLETION_STATUSES.has(statusLower);

  let structuredDate: Date | null =
    saleAny.completedAt instanceof Date
      ? saleAny.completedAt
      : saleAny.completedAt
        ? new Date(saleAny.completedAt)
        : null;

  if (!structuredDate && Array.isArray(saleAny.statusTransitions)) {
    const match = saleAny.statusTransitions.find((t) =>
      REPAIR_COMPLETION_STATUSES.has(String(t.toStatus ?? '').trim().toLowerCase()),
    );
    if (match?.changedAt) {
      structuredDate = new Date(match.changedAt);
    }
  }

  if (structuredDate && !Number.isNaN(structuredDate.getTime())) {
    const startMs = new Date(sale.saleDate).getTime();
    const diffHours = Math.max((structuredDate.getTime() - startMs) / 3_600_000, 0);
    return {
      isCompleted: true,
      completedAt: structuredDate,
      completedDateKey: formatKievDateKey(structuredDate),
      turnaroundHours: round1(diffHours),
      hasStructuredTimestamp: true,
    };
  }

  return {
    isCompleted: isCompletedStatus,
    completedAt: null,
    completedDateKey: '',
    turnaroundHours: null,
    hasStructuredTimestamp: false,
  };
};

const resolveOpenAgeBucket = (daysOpen: number) => {
  if (daysOpen <= 3) return '0-3';
  if (daysOpen <= 7) return '4-7';
  if (daysOpen <= 14) return '8-14';
  if (daysOpen <= 30) return '15-30';
  return '30+';
};

const loadRepairsDataset = async (query: RepairsReportQuery, now: Date) => {
  const todayKey = formatKievDateKey(now);
  const periodResolution = resolveBoundedPeriodWithPrevious(query, {
    defaultPeriod: 'last30',
    now,
  });

  const [repairs, purgedArchiveExists] = await Promise.all([
    Sale.find({ kind: 'repair' })
      .select({
        _id: 1,
        recordNumber: 1,
        saleDate: 1,
        status: 1,
        salePrice: 1,
        paidAmount: 1,
        master: 1,
        masterSnapshot: 1,
        clientSnapshot: 1,
        productSnapshot: 1,
        discount: 1,
        lineItems: 1,
        completedAt: 1,
        statusTransitions: 1,
      })
      .lean<SaleDocument[]>(),
    coldSalesPurgedExist(),
  ]);

  const statusFilter = String(query.status ?? '').trim().toLowerCase();
  const masterFilter = String(query.masterId ?? '').trim();
  const unassignedOnly =
    query.unassignedOnly === true ||
    String(query.unassignedOnly).toLowerCase() === 'true';
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const matchesOperationalFilters = (sale: SaleDocument) => {
    if (statusFilter && String(sale.status ?? '').trim().toLowerCase() !== statusFilter) {
      return false;
    }
    const mid = sale.master ? sale.master.toString() : '';
    if (unassignedOnly && mid) return false;
    if (masterFilter && masterFilter !== 'unassigned' && mid !== masterFilter) {
      return false;
    }
    if (masterFilter === 'unassigned' && mid) return false;
    if (searchQuery) {
      const hay = `${sale.recordNumber ?? ''} ${sale.clientSnapshot?.name ?? ''} ${sale.productSnapshot?.name ?? ''} ${sale.productSnapshot?.serialNumber ?? ''} ${sale.masterSnapshot?.name ?? ''}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  };

  const filtered = repairs.filter(matchesOperationalFilters);

  return {
    todayKey,
    periodResolution,
    repairs: filtered,
    purgedArchiveExists,
  };
};

export const getOrdersRepairsReport = async (
  query: RepairsReportQuery = {},
  now: Date = new Date(),
) => {
  const { todayKey, periodResolution, repairs, purgedArchiveExists } =
    await loadRepairsDataset(query, now);
  const { current, previous } = periodResolution;

  const openAgeBucketFilter = String(query.openAgeBucket ?? '').trim();

  // Open backlog & aging
  const byStatusMap = new Map<string, number>();
  const byTechMap = new Map<
    string,
    { technicianId: string | null; name: string; openCount: number; completedInPeriod: number }
  >();
  const openBucketOrder = ['0-3', '4-7', '8-14', '15-30', '30+'] as const;
  const openBucketMap = new Map<string, number>(openBucketOrder.map((b) => [b, 0]));

  let openCount = 0;
  let unassignedOpenCount = 0;

  // Completion & intake in bounded period
  const summarizeWindow = (dateFrom: string | null, dateTo: string | null) => {
    let intakeCount = 0;
    let trackedCompletedCount = 0;
    let untrackedCompletedCount = 0;
    const turnaroundValues: number[] = [];
    const dailyCompletedMap = new Map<
      string,
      { completed: number; tracked: number; turnaroundSum: number }
    >();

    for (const sale of repairs) {
      const intakeKey = formatKievDateKey(sale.saleDate);
      if (isDateKeyInsideRange(intakeKey, dateFrom, dateTo)) {
        intakeCount += 1;
      }

      const comp = resolveStructuredRepairCompletion(sale);
      if (!comp.isCompleted) continue;

      if (comp.hasStructuredTimestamp && comp.completedDateKey) {
        if (isDateKeyInsideRange(comp.completedDateKey, dateFrom, dateTo)) {
          trackedCompletedCount += 1;
          if (comp.turnaroundHours !== null) {
            turnaroundValues.push(comp.turnaroundHours);
          }
          const bucket = dailyCompletedMap.get(comp.completedDateKey) ?? {
            completed: 0,
            tracked: 0,
            turnaroundSum: 0,
          };
          bucket.completed += 1;
          bucket.tracked += 1;
          bucket.turnaroundSum += comp.turnaroundHours ?? 0;
          dailyCompletedMap.set(comp.completedDateKey, bucket);
        }
      } else if (isDateKeyInsideRange(intakeKey, dateFrom, dateTo)) {
        untrackedCompletedCount += 1;
      }
    }

    turnaroundValues.sort((a, b) => a - b);
    const avgTurnaroundHours =
      turnaroundValues.length > 0
        ? round1(
            turnaroundValues.reduce((s, h) => s + h, 0) / turnaroundValues.length,
          )
        : null;
    const medianTurnaroundHours =
      turnaroundValues.length > 0
        ? round1(
            turnaroundValues.length % 2 === 1
              ? turnaroundValues[Math.floor(turnaroundValues.length / 2)]!
              : (turnaroundValues[turnaroundValues.length / 2 - 1]! +
                  turnaroundValues[turnaroundValues.length / 2]!) /
                  2,
          )
        : null;

    return {
      intakeCount,
      trackedCompletedCount,
      untrackedCompletedCount,
      totalCompletedCount: trackedCompletedCount + untrackedCompletedCount,
      avgTurnaroundHours,
      medianTurnaroundHours,
      dailyCompletedMap,
    };
  };

  for (const sale of repairs) {
    const statusLower = String(sale.status ?? '').trim().toLowerCase();
    const isOpen = !OPEN_REPAIR_CLOSED_STATUSES.has(statusLower);
    const techId = sale.master ? sale.master.toString() : null;
    const techKey = techId ?? 'unassigned';
    const techName = techId
      ? sale.masterSnapshot?.name || 'Technician'
      : 'Unassigned';

    const techEntry = byTechMap.get(techKey) ?? {
      technicianId: techId,
      name: techName,
      openCount: 0,
      completedInPeriod: 0,
    };

    if (isOpen) {
      const daysOpen = Math.max(
        diffCalendarDaysInclusive(formatKievDateKey(sale.saleDate), todayKey) - 1,
        0,
      );
      const bucket = resolveOpenAgeBucket(daysOpen);
      openBucketMap.set(bucket, (openBucketMap.get(bucket) ?? 0) + 1);
      if (!openAgeBucketFilter || openAgeBucketFilter === bucket) {
        openCount += 1;
        if (!techId) unassignedOpenCount += 1;
        byStatusMap.set(sale.status, (byStatusMap.get(sale.status) ?? 0) + 1);
        techEntry.openCount += 1;
      }
    } else {
      const comp = resolveStructuredRepairCompletion(sale);
      const compKey = comp.completedDateKey;
      if (
        comp.hasStructuredTimestamp &&
        isDateKeyInsideRange(compKey, current.dateFrom, current.dateTo)
      ) {
        techEntry.completedInPeriod += 1;
      }
    }

    byTechMap.set(techKey, techEntry);
  }

  const curWindow = summarizeWindow(current.dateFrom, current.dateTo);
  const prevWindow = previous
    ? summarizeWindow(previous.dateFrom, previous.dateTo)
    : null;

  const dateKeys =
    current.dateFrom && current.dateTo
      ? listCalendarDateKeys(current.dateFrom, current.dateTo)
      : Array.from(curWindow.dailyCompletedMap.keys()).sort();

  const completionTrend = dateKeys.map((dateKey) => {
    const day = curWindow.dailyCompletedMap.get(dateKey);
    return {
      dateKey,
      completedCount: day?.completed ?? 0,
      avgTurnaroundHours:
        day && day.tracked > 0 ? round1(day.turnaroundSum / day.tracked) : null,
    };
  });

  const totalClosed = curWindow.totalCompletedCount;
  const coveragePct =
    totalClosed > 0
      ? round1((curWindow.trackedCompletedCount / totalClosed) * 100)
      : curWindow.trackedCompletedCount > 0
        ? 100
        : 0;

  const warnings: string[] = [];
  const warningItems: Array<{ code: string; count?: number }> = [];
  if (purgedArchiveExists) {
    const message =
      'Cold yearly archive purges exist; period analytics cover live persisted repairs only.';
    warnings.push(message);
    warningItems.push({ code: 'coldArchiveRepairs' });
  }
  if (curWindow.untrackedCompletedCount > 0) {
    warnings.push(
      `${curWindow.untrackedCompletedCount} closed repair(s) lack structured completion timestamps and are excluded from turnaround averages.`,
    );
    warningItems.push({
      code: 'untrackedCompletions',
      count: curWindow.untrackedCompletedCount,
    });
  } else if (totalClosed === 0) {
    warnings.push('No closed repairs with structured completion timestamps in this period.');
    warningItems.push({ code: 'noStructuredCompletions' });
  }

  return {
    generatedAt: now.toISOString(),
    timeZone: 'Europe/Kiev',
    period: {
      key: current.key,
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
    },
    previousPeriod: previous
      ? {
          dateFrom: previous.dateFrom,
          dateTo: previous.dateTo,
        }
      : null,
    summary: {
      openCount,
      unassignedOpenCount,
      intakeCount: curWindow.intakeCount,
      trackedCompletedCount: curWindow.trackedCompletedCount,
      untrackedCompletedCount: curWindow.untrackedCompletedCount,
      totalCompletedCount: curWindow.totalCompletedCount,
      avgTurnaroundHours: curWindow.avgTurnaroundHours,
      medianTurnaroundHours: curWindow.medianTurnaroundHours,
    },
    comparison: prevWindow
      ? {
          intakeCountPrev: prevWindow.intakeCount,
          intakeDeltaPct: calcPctDelta(curWindow.intakeCount, prevWindow.intakeCount),
          completedCountPrev: prevWindow.trackedCompletedCount,
          completedDeltaPct: calcPctDelta(
            curWindow.trackedCompletedCount,
            prevWindow.trackedCompletedCount,
          ),
          avgTurnaroundHoursPrev: prevWindow.avgTurnaroundHours,
        }
      : null,
    byStatus: Array.from(byStatusMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    byTechnician: Array.from(byTechMap.values()).sort(
      (a, b) => b.openCount - a.openCount || b.completedInPeriod - a.completedInPeriod,
    ),
    openAgingBuckets: openBucketOrder.map((bucket) => ({
      bucket,
      count: openBucketMap.get(bucket) ?? 0,
    })),
    completionTrend,
    turnaroundCoverage: {
      trackedCount: curWindow.trackedCompletedCount,
      untrackedCount: curWindow.untrackedCompletedCount,
      totalClosedCount: totalClosed,
      coveragePct,
      available: curWindow.trackedCompletedCount > 0,
      warning:
        curWindow.untrackedCompletedCount > 0
          ? 'Legacy closed orders without structured completion timestamps are excluded from turnaround metrics.'
          : null,
      warningCode:
        curWindow.untrackedCompletedCount > 0
          ? 'legacyCompletionsExcluded'
          : null,
    },
    coverage: {
      coldSalesPurgedExist: purgedArchiveExists,
      warnings,
      warningItems,
    },
  };
};

export const getOrdersRepairsDetails = async (
  query: RepairsReportQuery = {},
  now: Date = new Date(),
) => {
  const { todayKey, periodResolution, repairs } = await loadRepairsDataset(query, now);
  const { current } = periodResolution;
  const openAgeBucketFilter = String(query.openAgeBucket ?? '').trim();
  const mode = String(query.status ?? '').trim().toLowerCase() === 'completed'
    ? 'completed'
    : 'all';

  const rows = repairs
    .map((sale) => {
      const statusLower = String(sale.status ?? '').trim().toLowerCase();
      const isOpen = !OPEN_REPAIR_CLOSED_STATUSES.has(statusLower);
      const comp = resolveStructuredRepairCompletion(sale);
      const saleKey = formatKievDateKey(sale.saleDate);
      const daysOpen = Math.max(diffCalendarDaysInclusive(saleKey, todayKey) - 1, 0);
      const ageBucket = resolveOpenAgeBucket(daysOpen);

      if (openAgeBucketFilter && (!isOpen || ageBucket !== openAgeBucketFilter)) {
        return null;
      }
      if (mode === 'completed' && !comp.isCompleted) return null;
      if (
        !openAgeBucketFilter &&
        !isOpen &&
        !isDateKeyInsideRange(comp.completedDateKey || saleKey, current.dateFrom, current.dateTo)
      ) {
        return null;
      }

      return {
        id: sale._id.toString(),
        recordNumber: sale.recordNumber ?? null,
        saleDate: new Date(sale.saleDate).toISOString(),
        status: sale.status,
        clientName: sale.clientSnapshot?.name ?? '',
        deviceName: sale.productSnapshot?.name ?? '',
        serialNumber: sale.productSnapshot?.serialNumber ?? '',
        technicianName: sale.master ? sale.masterSnapshot?.name ?? 'Assigned' : 'Unassigned',
        technicianId: sale.master ? sale.master.toString() : null,
        isOpen,
        ageDays: isOpen ? daysOpen : null,
        ageBucket: isOpen ? ageBucket : null,
        completedAt: comp.completedAt ? comp.completedAt.toISOString() : null,
        turnaroundHours: comp.turnaroundHours,
        total: getSaleDocumentTotal(sale),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const sortBy = String(query.sortBy ?? 'saleDate').trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (sortBy === 'ageDays') return ((a.ageDays ?? -1) - (b.ageDays ?? -1)) * sortDir;
    if (sortBy === 'turnaroundHours') {
      return ((a.turnaroundHours ?? -1) - (b.turnaroundHours ?? -1)) * sortDir;
    }
    if (sortBy === 'total') return (a.total - b.total) * sortDir;
    return a.saleDate.localeCompare(b.saleDate) * sortDir;
  });

  const page = clampInt(query.page, 1, 1, 10000);
  const pageSize = clampInt(query.pageSize, 25, 1, 200);
  const skip = (page - 1) * pageSize;

  return {
    items: rows.slice(skip, skip + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
};

// -------------------- 2. ORDERS: SALES --------------------

export type SalesReportQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  lineKind?: 'all' | 'product' | 'service' | string;
  paymentMethod?: string;
  q?: string;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: string;
  sortDir?: string;
};

export const getOrdersSalesReport = async (
  query: SalesReportQuery = {},
  options: { includeCosts?: boolean; now?: Date } = {},
) => {
  const now = options.now ?? new Date();
  const includeCosts = options.includeCosts !== false;
  const periodResolution = resolveBoundedPeriodWithPrevious(query, {
    defaultPeriod: 'last30',
    now,
  });
  const { current, previous } = periodResolution;

  const [sales, purgedArchiveExists] = await Promise.all([
    Sale.find({ kind: 'sale' })
      .select({
        _id: 1,
        recordNumber: 1,
        saleDate: 1,
        status: 1,
        salePrice: 1,
        quantity: 1,
        paidAmount: 1,
        isRapidSale: 1,
        clientSnapshot: 1,
        discount: 1,
        paymentHistory: 1,
        lineItems: 1,
        returnEvents: 1,
      })
      .lean<SaleDocument[]>(),
    coldSalesPurgedExist(),
  ]);

  const statusFilter = String(query.status ?? '').trim().toLowerCase();
  const lineKindFilter = String(query.lineKind ?? 'all').trim().toLowerCase();
  const paymentMethodFilter = String(query.paymentMethod ?? '').trim().toLowerCase();
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const matchesFilters = (sale: SaleDocument) => {
    const s = String(sale.status ?? '').trim().toLowerCase();
    if (statusFilter && s !== statusFilter) return false;
    if (paymentMethodFilter) {
      const methods = (sale.paymentHistory ?? []).map((p) => p.paymentMethod);
      if (paymentMethodFilter === 'unpaid' && (sale.paidAmount ?? 0) > 0) return false;
      if (
        paymentMethodFilter !== 'unpaid' &&
        !methods.includes(paymentMethodFilter as 'cash' | 'non-cash')
      ) {
        return false;
      }
    }
    if (searchQuery) {
      const itemNames = (sale.lineItems ?? []).map((li) => li.name).join(' ');
      const hay = `${sale.recordNumber ?? ''} ${sale.clientSnapshot?.name ?? ''} ${itemNames}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  };

  const filteredSales = sales.filter(matchesFilters);

  const summarizeSalesWindow = (dateFrom: string | null, dateTo: string | null) => {
    let ordersCount = 0;
    let unitsSold = 0;
    let grossRevenue = 0;
    let discountAmount = 0;
    let netRevenue = 0;
    let collectedAmount = 0;
    let returnsCount = 0;
    let returnedUnits = 0;
    let returnedAmount = 0;
    let refundedAmount = 0;
    let productRevenue = 0;
    let serviceRevenue = 0;
    let productUnits = 0;
    let serviceUnits = 0;

    const byStatus = new Map<string, { status: string; count: number; netRevenue: number }>();
    const dailyMap = new Map<
      string,
      { netRevenue: number; ordersCount: number; units: number; returnsAmount: number }
    >();
    const topItemMap = new Map<
      string,
      { key: string; name: string; kind: 'product' | 'service'; units: number; revenue: number; knownCost: number; unknownCostCount: number }
    >();

    for (const sale of filteredSales) {
      const saleKey = formatKievDateKey(sale.saleDate);
      const statusLower = String(sale.status ?? '').trim().toLowerCase();
      const saleAny = sale as unknown as { returnEvents?: ReturnEventValue[] };

      // Count structured return events falling within the window
      for (const ret of saleAny.returnEvents ?? []) {
        const retKey = formatKievDateKey(ret.returnedAt);
        if (isDateKeyInsideRange(retKey, dateFrom, dateTo)) {
          returnsCount += 1;
          returnedUnits += Number(ret.quantity ?? 0);
          returnedAmount += Number(ret.grossAmount ?? 0);
          refundedAmount += Number(ret.refundAmount ?? 0);
          const day = dailyMap.get(retKey) ?? {
            netRevenue: 0,
            ordersCount: 0,
            units: 0,
            returnsAmount: 0,
          };
          day.returnsAmount = roundMoney(day.returnsAmount + Number(ret.grossAmount ?? 0));
          dailyMap.set(retKey, day);
        }
      }

      if (!isDateKeyInsideRange(saleKey, dateFrom, dateTo)) continue;
      if (statusLower === 'cancelled') continue;

      if (statusLower === 'returned') {
        if ((saleAny.returnEvents ?? []).length === 0) {
          returnsCount += 1;
          returnedUnits += Number(sale.quantity ?? 0);
          returnedAmount += getSaleDocumentTotal(sale);
          refundedAmount += Number(sale.paidAmount ?? 0);
        }
        continue;
      }

      const items = (sale.lineItems ?? []) as unknown as CostableSaleLineItem[];
      const matchingItems =
        lineKindFilter === 'product' || lineKindFilter === 'service'
          ? items.filter((li) => li.kind === lineKindFilter)
          : items;
      if (
        (lineKindFilter === 'product' || lineKindFilter === 'service') &&
        items.length > 0 &&
        matchingItems.length === 0
      ) {
        continue;
      }

      const grossAll =
        items.length > 0
          ? items.reduce((s, li) => s + Number(li.price ?? 0) * Number(li.quantity ?? 0), 0)
          : Number(sale.salePrice ?? 0) * Number(sale.quantity ?? 1);
      const totalDiscountAll = calcDiscountTotal(grossAll, sale.discount);

      let orderGross = 0;
      let orderNet = 0;
      let orderDiscount = 0;
      let orderUnits = 0;

      if (items.length > 0) {
        for (const li of matchingItems) {
          const lineGross = roundMoney(Number(li.price ?? 0) * Number(li.quantity ?? 0));
          const shareDiscount =
            grossAll > 0 ? roundMoney((lineGross / grossAll) * totalDiscountAll) : 0;
          const lineNet = roundMoney(Math.max(lineGross - shareDiscount, 0));
          const qty = Math.max(Number(li.quantity ?? 0), 0);

          orderGross += lineGross;
          orderDiscount += shareDiscount;
          orderNet += lineNet;
          orderUnits += qty;

          if (li.kind === 'service') {
            serviceRevenue += lineNet;
            serviceUnits += qty;
          } else {
            productRevenue += lineNet;
            productUnits += qty;
          }

          const itemKey = `${li.kind}:${String(li.name ?? '').trim().toLowerCase()}`;
          const itemEntry = topItemMap.get(itemKey) ?? {
            key: itemKey,
            name: li.name,
            kind: li.kind === 'service' ? 'service' : 'product',
            units: 0,
            revenue: 0,
            knownCost: 0,
            unknownCostCount: 0,
          };
          itemEntry.units += qty;
          itemEntry.revenue = roundMoney(itemEntry.revenue + lineNet);
          if (includeCosts) {
            const eff = resolveLineItemEffectiveCost(li);
            if (eff.status === 'known' && eff.totalCost !== null) {
              itemEntry.knownCost = roundMoney(itemEntry.knownCost + eff.totalCost);
            } else {
              itemEntry.unknownCostCount += 1;
            }
          }
          topItemMap.set(itemKey, itemEntry);
        }
      } else {
        orderGross = roundMoney(grossAll);
        orderDiscount = roundMoney(totalDiscountAll);
        orderNet = roundMoney(Math.max(grossAll - totalDiscountAll, 0));
        orderUnits = Math.max(Number(sale.quantity ?? 1), 1);
        productRevenue += orderNet;
        productUnits += orderUnits;
      }

      ordersCount += 1;
      grossRevenue = roundMoney(grossRevenue + orderGross);
      discountAmount = roundMoney(discountAmount + orderDiscount);
      netRevenue = roundMoney(netRevenue + orderNet);
      unitsSold += orderUnits;
      collectedAmount = roundMoney(collectedAmount + Number(sale.paidAmount ?? 0));

      const statusEntry = byStatus.get(sale.status) ?? {
        status: sale.status,
        count: 0,
        netRevenue: 0,
      };
      statusEntry.count += 1;
      statusEntry.netRevenue = roundMoney(statusEntry.netRevenue + orderNet);
      byStatus.set(sale.status, statusEntry);

      const day = dailyMap.get(saleKey) ?? {
        netRevenue: 0,
        ordersCount: 0,
        units: 0,
        returnsAmount: 0,
      };
      day.netRevenue = roundMoney(day.netRevenue + orderNet);
      day.ordersCount += 1;
      day.units += orderUnits;
      dailyMap.set(saleKey, day);
    }

    const aov = ordersCount > 0 ? roundMoney(netRevenue / ordersCount) : 0;
    return {
      ordersCount,
      unitsSold,
      grossRevenue,
      discountAmount,
      netRevenue,
      collectedAmount,
      aov,
      returnsCount,
      returnedUnits,
      returnedAmount: roundMoney(returnedAmount),
      refundedAmount: roundMoney(refundedAmount),
      productRevenue: roundMoney(productRevenue),
      serviceRevenue: roundMoney(serviceRevenue),
      productUnits,
      serviceUnits,
      byStatus: Array.from(byStatus.values()).sort((a, b) => b.netRevenue - a.netRevenue),
      topItems: Array.from(topItemMap.values())
        .map((row) =>
          includeCosts
            ? row
            : { key: row.key, name: row.name, kind: row.kind, units: row.units, revenue: row.revenue },
        )
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
      dailyMap,
    };
  };

  const cur = summarizeSalesWindow(current.dateFrom, current.dateTo);
  const prev = previous ? summarizeSalesWindow(previous.dateFrom, previous.dateTo) : null;

  const dateKeys =
    current.dateFrom && current.dateTo
      ? listCalendarDateKeys(current.dateFrom, current.dateTo)
      : Array.from(cur.dailyMap.keys()).sort();

  const trend = dateKeys.map((dateKey) => {
    const day = cur.dailyMap.get(dateKey);
    return {
      dateKey,
      revenue: day?.netRevenue ?? 0,
      ordersCount: day?.ordersCount ?? 0,
      units: day?.units ?? 0,
      returnsAmount: day?.returnsAmount ?? 0,
    };
  });

  const warnings: string[] = [];
  const warningItems: Array<{ code: string; count?: number }> = [];
  if (purgedArchiveExists) {
    warnings.push(
      'Cold yearly archive purges exist; sales figures reflect live persisted records only.',
    );
    warningItems.push({ code: 'coldArchiveSales' });
  }

  return {
    generatedAt: now.toISOString(),
    timeZone: 'Europe/Kiev',
    period: {
      key: current.key,
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
    },
    previousPeriod: previous
      ? { dateFrom: previous.dateFrom, dateTo: previous.dateTo }
      : null,
    summary: {
      ordersCount: cur.ordersCount,
      unitsSold: cur.unitsSold,
      grossRevenue: cur.grossRevenue,
      discountAmount: cur.discountAmount,
      netRevenue: cur.netRevenue,
      collectedAmount: cur.collectedAmount,
      aov: cur.aov,
      returnsCount: cur.returnsCount,
      returnedUnits: cur.returnedUnits,
      returnedAmount: cur.returnedAmount,
      refundedAmount: cur.refundedAmount,
    },
    comparison: prev
      ? {
          netRevenuePrev: prev.netRevenue,
          netRevenueDeltaPct: calcPctDelta(cur.netRevenue, prev.netRevenue),
          ordersCountPrev: prev.ordersCount,
          ordersCountDeltaPct: calcPctDelta(cur.ordersCount, prev.ordersCount),
          unitsSoldPrev: prev.unitsSold,
          unitsSoldDeltaPct: calcPctDelta(cur.unitsSold, prev.unitsSold),
          aovPrev: prev.aov,
          aovDeltaPct: calcPctDelta(cur.aov, prev.aov),
          returnsAmountPrev: prev.returnedAmount,
        }
      : null,
    mix: {
      productRevenue: cur.productRevenue,
      serviceRevenue: cur.serviceRevenue,
      productUnits: cur.productUnits,
      serviceUnits: cur.serviceUnits,
      productSharePct:
        cur.netRevenue > 0 ? round1((cur.productRevenue / cur.netRevenue) * 100) : 0,
      serviceSharePct:
        cur.netRevenue > 0 ? round1((cur.serviceRevenue / cur.netRevenue) * 100) : 0,
    },
    byStatus: cur.byStatus,
    topItems: cur.topItems,
    trend,
    coverage: {
      coldSalesPurgedExist: purgedArchiveExists,
      warnings,
      warningItems,
    },
  };
};

export const getOrdersSalesDetails = async (
  query: SalesReportQuery = {},
  options: { now?: Date } = {},
) => {
  const now = options.now ?? new Date();
  const { current } = resolveBoundedPeriodWithPrevious(query, {
    defaultPeriod: 'last30',
    now,
  });
  const sales = await Sale.find({ kind: 'sale' })
    .select({
      _id: 1,
      recordNumber: 1,
      saleDate: 1,
      status: 1,
      salePrice: 1,
      quantity: 1,
      paidAmount: 1,
      clientSnapshot: 1,
      discount: 1,
      lineItems: 1,
      returnEvents: 1,
      isRapidSale: 1,
      paymentHistory: 1,
    })
    .lean<SaleDocument[]>();

  const statusFilter = String(query.status ?? '').trim().toLowerCase();
  const lineKindFilter = String(query.lineKind ?? 'all').trim().toLowerCase();
  const paymentMethodFilter = String(query.paymentMethod ?? '').trim().toLowerCase();
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const rows = sales
    .filter((sale) => {
      const key = formatKievDateKey(sale.saleDate);
      if (!isDateKeyInsideRange(key, current.dateFrom, current.dateTo)) return false;
      if (statusFilter && String(sale.status ?? '').toLowerCase() !== statusFilter) {
        return false;
      }
      if (paymentMethodFilter) {
        const methods = (sale.paymentHistory ?? []).map((p) => p.paymentMethod);
        if (paymentMethodFilter === 'unpaid' && (sale.paidAmount ?? 0) > 0) return false;
        if (
          paymentMethodFilter !== 'unpaid' &&
          !methods.includes(paymentMethodFilter as 'cash' | 'non-cash')
        ) {
          return false;
        }
      }
      if (lineKindFilter === 'product' || lineKindFilter === 'service') {
        const items = sale.lineItems ?? [];
        if (items.length > 0 && !items.some((li) => li.kind === lineKindFilter)) {
          return false;
        }
        if (items.length === 0 && lineKindFilter === 'service') {
          return false;
        }
      }
      if (searchQuery) {
        const hay = `${sale.recordNumber ?? ''} ${sale.clientSnapshot?.name ?? ''} ${(sale.lineItems ?? []).map((i) => i.name).join(' ')}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    })
    .map((sale) => {
      const total = getSaleDocumentTotal(sale);
      const items = sale.lineItems ?? [];
      const units =
        items.length > 0
          ? items.reduce((s, li) => s + Number(li.quantity ?? 0), 0)
          : Number(sale.quantity ?? 1);
      const gross =
        items.length > 0
          ? items.reduce((s, li) => s + Number(li.price ?? 0) * Number(li.quantity ?? 0), 0)
          : Number(sale.salePrice ?? 0) * Number(sale.quantity ?? 1);
      return {
        id: sale._id.toString(),
        recordNumber: sale.recordNumber ?? null,
        saleDate: new Date(sale.saleDate).toISOString(),
        status: sale.status,
        clientName: sale.clientSnapshot?.name ?? '',
        units,
        grossTotal: roundMoney(gross),
        discountTotal: roundMoney(Math.max(gross - total, 0)),
        netTotal: total,
        paidAmount: roundMoney(Number(sale.paidAmount ?? 0)),
        returnCount: ((sale as unknown as { returnEvents?: unknown[] }).returnEvents ?? []).length,
        isRapidSale: sale.isRapidSale === true,
      };
    });

  const sortBy = String(query.sortBy ?? 'saleDate').trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (sortBy === 'netTotal') return (a.netTotal - b.netTotal) * sortDir;
    if (sortBy === 'units') return (a.units - b.units) * sortDir;
    return a.saleDate.localeCompare(b.saleDate) * sortDir;
  });

  const page = clampInt(query.page, 1, 1, 10000);
  const pageSize = clampInt(query.pageSize, 25, 1, 200);
  const skip = (page - 1) * pageSize;

  return {
    items: rows.slice(skip, skip + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
};

// -------------------- 3. ORDERS: PROCUREMENT --------------------

export type ProcurementReportQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  supplierId?: string;
  status?: string;
  overdueOnly?: string | boolean;
  q?: string;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: string;
  sortDir?: string;
};

export const getOrdersProcurementReport = async (
  query: ProcurementReportQuery = {},
  now: Date = new Date(),
) => {
  const todayKey = formatKievDateKey(now);
  const periodResolution = resolveBoundedPeriodWithPrevious(query, {
    defaultPeriod: 'last30',
    now,
  });
  const { current, previous } = periodResolution;

  const [orders, suppliers] = await Promise.all([
    SupplierOrder.find({})
      .select({
        _id: 1,
        orderBaseId: 1,
        number: 1,
        supplier: 1,
        deliveryDate: 1,
        supplyType: 1,
        status: 1,
        paymentStatus: 1,
        receiptStatus: 1,
        total: 1,
        paid: 1,
        items: 1,
        stockedAt: 1,
        createdAt: 1,
      })
      .lean<SupplierOrderDocument[]>(),
    Supplier.find({}).select({ _id: 1, name: 1 }).lean(),
  ]);

  const supplierNameMap = new Map(
    suppliers.map((s) => [s._id.toString(), s.name]),
  );

  const supplierFilter = String(query.supplierId ?? '').trim();
  const statusFilter = String(query.status ?? '').trim().toLowerCase();
  const overdueOnly =
    query.overdueOnly === true ||
    String(query.overdueOnly).toLowerCase() === 'true';
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const isOrderOverdue = (order: SupplierOrderDocument) => {
    if (order.status === 'overdue') return true;
    if (['cancelled', 'unavailable', 'stocked'].includes(order.status)) return false;
    if (order.receiptStatus === 'received') return false;
    const deliveryKey = formatKievDateKey(order.deliveryDate);
    return Boolean(deliveryKey) && deliveryKey < todayKey;
  };

  const filteredOrders = orders.filter((order) => {
    const sid = order.supplier ? order.supplier.toString() : '';
    if (supplierFilter && sid !== supplierFilter) return false;
    if (statusFilter && String(order.status ?? '').toLowerCase() !== statusFilter) {
      return false;
    }
    if (overdueOnly && !isOrderOverdue(order)) return false;
    if (searchQuery) {
      const sName = supplierNameMap.get(sid) ?? '';
      const itemNames = (order.items ?? []).map((i) => i.productName).join(' ');
      const hay = `${order.number ?? ''} ${order.orderBaseId} ${sName} ${itemNames}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });

  const summarizeWindow = (dateFrom: string | null, dateTo: string | null) => {
    let ordersCount = 0;
    let orderedUnits = 0;
    let receivedUnits = 0;
    let cancelledUnits = 0;
    let pendingUnits = 0;
    let totalSpend = 0;
    let paidAmount = 0;
    let outstandingAmount = 0;
    let overdueOrdersCount = 0;
    let overduePendingUnits = 0;

    let trackedReceiptItems = 0;
    let untrackedLegacyReceiptItems = 0;
    let onTimeReceiptItems = 0;
    let lateReceiptItems = 0;
    let totalLeadDays = 0;

    const bySupplierMap = new Map<
      string,
      {
        supplierId: string;
        supplierName: string;
        ordersCount: number;
        orderedUnits: number;
        receivedUnits: number;
        totalSpend: number;
        paidAmount: number;
        outstandingAmount: number;
        overdueCount: number;
        leadDaysSum: number;
        leadDaysCount: number;
      }
    >();

    const byProductMap = new Map<
      string,
      {
        key: string;
        productName: string;
        catalogProductId: string | null;
        ordersCount: number;
        orderedUnits: number;
        receivedUnits: number;
        totalSpend: number;
        minPrice: number;
        maxPrice: number;
        weightedSum: number;
        latestPrice: number;
        latestDate: number;
      }
    >();

    const dailyMap = new Map<
      string,
      { dateKey: string; spend: number; paid: number; ordersCount: number; orderedUnits: number; receivedUnits: number }
    >();

    for (const order of filteredOrders) {
      const orderDateKey = formatKievDateKey(order.createdAt);
      if (!isDateKeyInsideRange(orderDateKey, dateFrom, dateTo)) continue;

      ordersCount += 1;
      const isCancelledOrder =
        order.status === 'cancelled' || order.status === 'unavailable';
      const orderTotal = roundMoney(Number(order.total ?? 0));
      const orderPaid = roundMoney(Number(order.paid ?? 0));
      const orderOutstanding = isCancelledOrder
        ? 0
        : roundMoney(Math.max(orderTotal - orderPaid, 0));
      const overdue = isOrderOverdue(order);

      if (!isCancelledOrder) {
        totalSpend = roundMoney(totalSpend + orderTotal);
        paidAmount = roundMoney(paidAmount + orderPaid);
        outstandingAmount = roundMoney(outstandingAmount + orderOutstanding);
      }
      if (overdue) overdueOrdersCount += 1;

      const sid = order.supplier ? order.supplier.toString() : 'unknown';
      const supEntry = bySupplierMap.get(sid) ?? {
        supplierId: sid,
        supplierName: supplierNameMap.get(sid) ?? 'Supplier',
        ordersCount: 0,
        orderedUnits: 0,
        receivedUnits: 0,
        totalSpend: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        overdueCount: 0,
        leadDaysSum: 0,
        leadDaysCount: 0,
      };
      supEntry.ordersCount += 1;
      if (!isCancelledOrder) {
        supEntry.totalSpend = roundMoney(supEntry.totalSpend + orderTotal);
        supEntry.paidAmount = roundMoney(supEntry.paidAmount + orderPaid);
        supEntry.outstandingAmount = roundMoney(
          supEntry.outstandingAmount + orderOutstanding,
        );
      }
      if (overdue) supEntry.overdueCount += 1;

      const deliveryKey = formatKievDateKey(order.deliveryDate);
      const dayEntry = dailyMap.get(orderDateKey) ?? {
        dateKey: orderDateKey,
        spend: 0,
        paid: 0,
        ordersCount: 0,
        orderedUnits: 0,
        receivedUnits: 0,
      };
      dayEntry.ordersCount += 1;
      if (!isCancelledOrder) {
        dayEntry.spend = roundMoney(dayEntry.spend + orderTotal);
        dayEntry.paid = roundMoney(dayEntry.paid + orderPaid);
      }

      const seenProductsInOrder = new Set<string>();
      for (const item of order.items ?? []) {
        const qty = Math.max(Number(item.quantity ?? 0), 0);
        const price = Math.max(Number(item.price ?? 0), 0);
        const rStatus = item.receiptStatus ?? 'new';
        orderedUnits += qty;
        supEntry.orderedUnits += qty;
        dayEntry.orderedUnits += qty;

        if (rStatus === 'received') {
          receivedUnits += qty;
          supEntry.receivedUnits += qty;
          dayEntry.receivedUnits += qty;

          const itemReceivedAt =
            (item as { receivedAt?: Date | null }).receivedAt ??
            (order as { stockedAt?: Date | null }).stockedAt ??
            null;

          if (itemReceivedAt) {
            const recDate = new Date(itemReceivedAt);
            const recKey = formatKievDateKey(recDate);
            const leadDays = Math.max(
              (recDate.getTime() - new Date(order.createdAt).getTime()) / 86_400_000,
              0,
            );
            trackedReceiptItems += 1;
            totalLeadDays += leadDays;
            supEntry.leadDaysSum += leadDays;
            supEntry.leadDaysCount += 1;
            if (deliveryKey && recKey) {
              if (recKey <= deliveryKey) onTimeReceiptItems += 1;
              else lateReceiptItems += 1;
            }
          } else {
            untrackedLegacyReceiptItems += 1;
          }
        } else if (rStatus === 'cancelled') {
          cancelledUnits += qty;
        } else {
          pendingUnits += qty;
          if (overdue) overduePendingUnits += qty;
        }

        if (!isCancelledOrder && rStatus !== 'cancelled') {
          const cid = item.catalogProductId
            ? item.catalogProductId.toString()
            : null;
          const normName = String(item.productName ?? '')
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
          const pKey = cid ?? normName;
          if (pKey) {
            const pEntry = byProductMap.get(pKey) ?? {
              key: pKey,
              productName: item.productName,
              catalogProductId: cid,
              ordersCount: 0,
              orderedUnits: 0,
              receivedUnits: 0,
              totalSpend: 0,
              minPrice: price,
              maxPrice: price,
              weightedSum: 0,
              latestPrice: price,
              latestDate: 0,
            };
            if (!seenProductsInOrder.has(pKey)) {
              pEntry.ordersCount += 1;
              seenProductsInOrder.add(pKey);
            }
            pEntry.orderedUnits += qty;
            if (rStatus === 'received') pEntry.receivedUnits += qty;
            pEntry.totalSpend = roundMoney(pEntry.totalSpend + qty * price);
            pEntry.weightedSum += qty * price;
            pEntry.minPrice = Math.min(pEntry.minPrice, price);
            pEntry.maxPrice = Math.max(pEntry.maxPrice, price);
            const createdMs = new Date(order.createdAt).getTime();
            if (createdMs >= pEntry.latestDate) {
              pEntry.latestDate = createdMs;
              pEntry.latestPrice = price;
            }
            byProductMap.set(pKey, pEntry);
          }
        }
      }

      bySupplierMap.set(sid, supEntry);
      dailyMap.set(orderDateKey, dayEntry);
    }

    const totalReceivedItemsForCoverage =
      trackedReceiptItems + untrackedLegacyReceiptItems;

    return {
      ordersCount,
      orderedUnits,
      receivedUnits,
      cancelledUnits,
      pendingUnits,
      totalSpend,
      paidAmount,
      outstandingAmount,
      overdueOrdersCount,
      overduePendingUnits,
      receiptPerformance: {
        trackedItemsCount: trackedReceiptItems,
        untrackedLegacyItemsCount: untrackedLegacyReceiptItems,
        totalReceivedItemsCount: totalReceivedItemsForCoverage,
        coveragePct:
          totalReceivedItemsForCoverage > 0
            ? round1((trackedReceiptItems / totalReceivedItemsForCoverage) * 100)
            : 0,
        onTimeCount: onTimeReceiptItems,
        lateCount: lateReceiptItems,
        onTimeRatePct:
          onTimeReceiptItems + lateReceiptItems > 0
            ? round1(
                (onTimeReceiptItems / (onTimeReceiptItems + lateReceiptItems)) *
                  100,
              )
            : null,
        avgReceiptLeadDays:
          trackedReceiptItems > 0
            ? round1(totalLeadDays / trackedReceiptItems)
            : null,
        available: trackedReceiptItems > 0,
      },
      bySupplier: Array.from(bySupplierMap.values())
        .map((s) => ({
          ...s,
          avgReceiptLeadDays:
            s.leadDaysCount > 0 ? round1(s.leadDaysSum / s.leadDaysCount) : null,
        }))
        .sort((a, b) => b.totalSpend - a.totalSpend),
      byProduct: Array.from(byProductMap.values())
        .map((p) => ({
          key: p.key,
          productName: p.productName,
          catalogProductId: p.catalogProductId,
          ordersCount: p.ordersCount,
          orderedUnits: p.orderedUnits,
          receivedUnits: p.receivedUnits,
          totalSpend: p.totalSpend,
          minPrice: p.minPrice,
          maxPrice: p.maxPrice,
          avgPrice: p.orderedUnits > 0 ? roundMoney(p.weightedSum / p.orderedUnits) : 0,
          latestPrice: p.latestPrice,
          priceVariationPct:
            p.minPrice > 0
              ? round1(((p.maxPrice - p.minPrice) / p.minPrice) * 100)
              : 0,
        }))
        .sort((a, b) => b.totalSpend - a.totalSpend),
      dailyMap,
    };
  };

  const cur = summarizeWindow(current.dateFrom, current.dateTo);
  const prev = previous ? summarizeWindow(previous.dateFrom, previous.dateTo) : null;

  const dateKeys =
    current.dateFrom && current.dateTo
      ? listCalendarDateKeys(current.dateFrom, current.dateTo)
      : Array.from(cur.dailyMap.keys()).sort();

  const trend = dateKeys.map((dateKey) => {
    const day = cur.dailyMap.get(dateKey);
    return {
      dateKey,
      spend: day?.spend ?? 0,
      paid: day?.paid ?? 0,
      ordersCount: day?.ordersCount ?? 0,
      orderedUnits: day?.orderedUnits ?? 0,
      receivedUnits: day?.receivedUnits ?? 0,
    };
  });

  const warnings: string[] = [];
  const warningItems: Array<{ code: string; count?: number }> = [];
  if (cur.receiptPerformance.untrackedLegacyItemsCount > 0) {
    warnings.push(
      `${cur.receiptPerformance.untrackedLegacyItemsCount} legacy received item(s) lack structured receipt timestamps and are excluded from lead-time & on-time performance.`,
    );
    warningItems.push({
      code: 'untrackedReceipts',
      count: cur.receiptPerformance.untrackedLegacyItemsCount,
    });
  }

  return {
    generatedAt: now.toISOString(),
    timeZone: 'Europe/Kiev',
    period: {
      key: current.key,
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
    },
    previousPeriod: previous
      ? { dateFrom: previous.dateFrom, dateTo: previous.dateTo }
      : null,
    summary: {
      ordersCount: cur.ordersCount,
      orderedUnits: cur.orderedUnits,
      receivedUnits: cur.receivedUnits,
      cancelledUnits: cur.cancelledUnits,
      pendingUnits: cur.pendingUnits,
      totalSpend: cur.totalSpend,
      paidAmount: cur.paidAmount,
      outstandingAmount: cur.outstandingAmount,
      overdueOrdersCount: cur.overdueOrdersCount,
      overduePendingUnits: cur.overduePendingUnits,
    },
    comparison: prev
      ? {
          totalSpendPrev: prev.totalSpend,
          totalSpendDeltaPct: calcPctDelta(cur.totalSpend, prev.totalSpend),
          ordersCountPrev: prev.ordersCount,
          ordersCountDeltaPct: calcPctDelta(cur.ordersCount, prev.ordersCount),
          orderedUnitsPrev: prev.orderedUnits,
          orderedUnitsDeltaPct: calcPctDelta(cur.orderedUnits, prev.orderedUnits),
          receivedUnitsPrev: prev.receivedUnits,
        }
      : null,
    receiptPerformance: cur.receiptPerformance,
    bySupplier: cur.bySupplier,
    byProduct: cur.byProduct,
    trend,
    supplierOptions: suppliers
      .map((s) => ({ id: s._id.toString(), name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    coverage: {
      warnings,
      warningItems,
    },
  };
};

export const getOrdersProcurementDetails = async (
  query: ProcurementReportQuery = {},
  now: Date = new Date(),
) => {
  const todayKey = formatKievDateKey(now);
  const { current } = resolveBoundedPeriodWithPrevious(query, {
    defaultPeriod: 'last30',
    now,
  });

  const [orders, suppliers] = await Promise.all([
    SupplierOrder.find({})
      .select({
        _id: 1,
        orderBaseId: 1,
        number: 1,
        supplier: 1,
        deliveryDate: 1,
        status: 1,
        paymentStatus: 1,
        receiptStatus: 1,
        total: 1,
        paid: 1,
        items: 1,
        stockedAt: 1,
        createdAt: 1,
      })
      .lean<SupplierOrderDocument[]>(),
    Supplier.find({}).select({ _id: 1, name: 1 }).lean(),
  ]);

  const supplierNameMap = new Map(suppliers.map((s) => [s._id.toString(), s.name]));
  const supplierFilter = String(query.supplierId ?? '').trim();
  const statusFilter = String(query.status ?? '').trim().toLowerCase();
  const overdueOnly =
    query.overdueOnly === true ||
    String(query.overdueOnly).toLowerCase() === 'true';
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const rows = orders
    .filter((order) => {
      const key = formatKievDateKey(order.createdAt);
      if (!isDateKeyInsideRange(key, current.dateFrom, current.dateTo)) return false;
      const sid = order.supplier ? order.supplier.toString() : '';
      if (supplierFilter && sid !== supplierFilter) return false;
      if (statusFilter && String(order.status ?? '').toLowerCase() !== statusFilter) {
        return false;
      }
      const deliveryKey = formatKievDateKey(order.deliveryDate);
      const isOverdue =
        order.status === 'overdue' ||
        (!['cancelled', 'unavailable', 'stocked'].includes(order.status) &&
          order.receiptStatus !== 'received' &&
          Boolean(deliveryKey) &&
          deliveryKey < todayKey);
      if (overdueOnly && !isOverdue) return false;
      if (searchQuery) {
        const sName = supplierNameMap.get(sid) ?? '';
        const itemNames = (order.items ?? []).map((i) => i.productName).join(' ');
        const hay = `${order.number ?? ''} ${order.orderBaseId} ${sName} ${itemNames}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    })
    .map((order) => {
      const sid = order.supplier ? order.supplier.toString() : '';
      const deliveryKey = formatKievDateKey(order.deliveryDate);
      const isOverdue =
        order.status === 'overdue' ||
        (!['cancelled', 'unavailable', 'stocked'].includes(order.status) &&
          order.receiptStatus !== 'received' &&
          Boolean(deliveryKey) &&
          deliveryKey < todayKey);
      const orderedUnits = (order.items ?? []).reduce(
        (s, i) => s + Math.max(Number(i.quantity ?? 0), 0),
        0,
      );
      const receivedUnits = (order.items ?? []).reduce(
        (s, i) =>
          s + (i.receiptStatus === 'received' ? Math.max(Number(i.quantity ?? 0), 0) : 0),
        0,
      );
      return {
        id: order._id.toString(),
        displayNumber: order.number?.trim() || order.orderBaseId,
        orderBaseId: order.orderBaseId,
        supplierId: sid,
        supplierName: supplierNameMap.get(sid) ?? 'Supplier',
        createdAt: new Date(order.createdAt).toISOString(),
        deliveryDate: new Date(order.deliveryDate).toISOString(),
        status: order.status,
        paymentStatus: order.paymentStatus,
        receiptStatus: order.receiptStatus,
        isOverdue,
        orderedUnits,
        receivedUnits,
        total: roundMoney(Number(order.total ?? 0)),
        paid: roundMoney(Number(order.paid ?? 0)),
        outstanding: ['cancelled', 'unavailable'].includes(order.status)
          ? 0
          : roundMoney(Math.max(Number(order.total ?? 0) - Number(order.paid ?? 0), 0)),
        stockedAt: (order as { stockedAt?: Date | null }).stockedAt
          ? new Date((order as { stockedAt: Date }).stockedAt).toISOString()
          : null,
      };
    });

  const sortBy = String(query.sortBy ?? 'createdAt').trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    if (sortBy === 'total') return (a.total - b.total) * sortDir;
    if (sortBy === 'outstanding') return (a.outstanding - b.outstanding) * sortDir;
    if (sortBy === 'deliveryDate') return a.deliveryDate.localeCompare(b.deliveryDate) * sortDir;
    return a.createdAt.localeCompare(b.createdAt) * sortDir;
  });

  const page = clampInt(query.page, 1, 1, 10000);
  const pageSize = clampInt(query.pageSize, 25, 1, 200);
  const skip = (page - 1) * pageSize;

  return {
    items: rows.slice(skip, skip + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
};
