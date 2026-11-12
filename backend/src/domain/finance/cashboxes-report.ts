import { Cashbox, FinanceTransaction, type CashboxDocument, type FinanceTransactionDocument } from './model';
import { listCurrencyDocuments } from './internal';
import { getActiveFinancePeriodSnapshot } from './period-snapshot';
import { Sale, type SaleDocument } from '../sale/model';

const normalizeBalancesRecord = (
  balances: unknown,
): Record<string, number> => {
  if (!balances) return {};
  if (balances instanceof Map) {
    return Object.fromEntries(
      Array.from(balances.entries()).map(([k, v]) => [String(k).toUpperCase(), Number(v ?? 0)]),
    );
  }
  if (typeof balances === 'object') {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(balances as Record<string, unknown>)) {
      out[k.toUpperCase()] = Number(v ?? 0);
    }
    return out;
  }
  return {};
};

const resolveCashboxCurrencyBalance = (
  cashbox: { balances?: unknown },
  currency: string,
) => {
  const rec = normalizeBalancesRecord(cashbox.balances);
  const val = rec[currency.toUpperCase()] ?? 0;
  return Number.isFinite(val) ? val : 0;
};
import { SupplierOrder, type SupplierOrderDocument } from '../supplier-order/model';
import { getSaleDocumentTotal } from '../../shared/lib/saleTotals';
import {
  addCalendarDays,
  diffCalendarDaysInclusive,
  formatKievDateKey,
  isDateKeyInsideRange,
  listCalendarDateKeys,
  resolveBoundedPeriodWithPrevious,
} from '../analytics/period-utils';

export type CashboxesReportQuery = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  cashboxId?: string;
  currency?: string;
  type?: string;
  category?: string;
  q?: string;
  horizonDays?: number | string;
  demandMultiplier?: number | string;
  inflowMultiplier?: number | string;
  outflowMultiplier?: number | string;
  inflowTimingShiftDays?: number | string;
  outflowTimingShiftDays?: number | string;
  plannedEvents?: unknown;
  page?: number | string;
  pageSize?: number | string;
  sortBy?: string;
  sortDir?: string;
};

export type PlannedCashEventInput = {
  id: string;
  title: string;
  type: 'inflow' | 'outflow';
  amount: number;
  currency: string;
  scheduledDate: string;
  obligationKind?: 'supplier_order' | 'sale_balance' | null;
  obligationId?: string | null;
};

const roundMoney = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;

const clampInt = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

const clampFloat = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const resolveHorizonDays = (v: unknown): 30 | 60 | 90 => {
  const n = Number(v);
  if (n === 60 || n === 90) return n;
  return 30;
};

const parsePlannedEvents = (raw: unknown): PlannedCashEventInput[] => {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }
  return list
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, 100)
    .map((entry, idx) => {
      const e = entry as Record<string, unknown>;
      const amount = Number(e.amount ?? 0);
      return {
        id: String(e.id ?? `evt-${idx + 1}`).trim() || `evt-${idx + 1}`,
        title: String(e.title ?? '').trim().slice(0, 120),
        type: e.type === 'outflow' ? 'outflow' : 'inflow',
        amount:
          Number.isFinite(amount) && amount >= 0
            ? roundMoney(amount)
            : 0,
        currency: String(e.currency ?? 'UAH').trim().toUpperCase() || 'UAH',
        scheduledDate: String(e.scheduledDate ?? '').trim(),
        obligationKind:
          e.obligationKind === 'supplier_order' || e.obligationKind === 'sale_balance'
            ? e.obligationKind
            : null,
        obligationId: e.obligationId ? String(e.obligationId).trim() : null,
      };
    });
};

const isActiveNonCancellationTx = (tx: {
  status?: string | null;
  isCancellation?: boolean | null;
}) =>
  String(tx.status ?? 'active').toLowerCase() !== 'cancelled' &&
  tx.isCancellation !== true;

export const getCashboxesReport = async (
  query: CashboxesReportQuery = {},
  now: Date = new Date(),
) => {
  const todayKey = formatKievDateKey(now);
  const trailStartKey = addCalendarDays(todayKey, -89);
  const periodResolution = resolveBoundedPeriodWithPrevious(query, {
    defaultPeriod: 'last30',
    now,
  });
  const { current, previous } = periodResolution;

  const horizonDays = resolveHorizonDays(query.horizonDays);
  const demandMultiplier = clampFloat(query.demandMultiplier, 1, 0, 10);
  const inflowMultiplier = clampFloat(query.inflowMultiplier, 1, 0, 10);
  const outflowMultiplier = clampFloat(query.outflowMultiplier, 1, 0, 10);
  const inflowTimingShiftDays = clampInt(query.inflowTimingShiftDays, 0, -60, 60);
  const outflowTimingShiftDays = clampInt(query.outflowTimingShiftDays, 0, -60, 60);
  const plannedEvents = parsePlannedEvents(query.plannedEvents);

  const [
    cashboxes,
    currencies,
    transactions,
    activeSnapshot,
    openSupplierOrders,
    unpaidSales,
  ] = await Promise.all([
    Cashbox.find({ isArchived: { $ne: true } })
      .sort({ sortOrder: 1, name: 1 })
      .lean<CashboxDocument[]>(),
    listCurrencyDocuments({ includeArchived: true }),
    FinanceTransaction.find({})
      .select({
        _id: 1,
        type: 1,
        amount: 1,
        currency: 1,
        fromCashbox: 1,
        toCashbox: 1,
        category: 1,
        note: 1,
        status: 1,
        isCancellation: 1,
        transactionDate: 1,
        createdAt: 1,
      })
      .sort({ transactionDate: -1, createdAt: -1 })
      .lean<FinanceTransactionDocument[]>(),
    getActiveFinancePeriodSnapshot(),
    SupplierOrder.find({
      status: { $nin: ['cancelled', 'unavailable'] },
      paymentStatus: 'pending',
    })
      .select({
        _id: 1,
        orderBaseId: 1,
        number: 1,
        total: 1,
        paid: 1,
        deliveryDate: 1,
      })
      .lean<SupplierOrderDocument[]>(),
    Sale.find({
      status: { $nin: ['cancelled', 'returned'] },
    })
      .select({
        _id: 1,
        recordNumber: 1,
        saleDate: 1,
        status: 1,
        salePrice: 1,
        quantity: 1,
        paidAmount: 1,
        discount: 1,
        lineItems: 1,
        clientSnapshot: 1,
      })
      .lean<SaleDocument[]>(),
  ]);

  const cashboxFilter = String(query.cashboxId ?? '').trim();
  const currencyFilter = String(query.currency ?? '').trim().toUpperCase();
  const categoryFilter = String(query.category ?? '').trim().toLowerCase();
  const typeFilter = String(query.type ?? 'all').trim().toLowerCase();
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const matchingCashboxes = cashboxFilter
    ? cashboxes.filter((cb) => cb._id.toString() === cashboxFilter)
    : cashboxes;

  const activeTxs = transactions.filter(isActiveNonCancellationTx);

  // Collect observed currency codes cleanly, preserving UAH first.
  const observedCurrencies = new Set<string>(
    currencies
      .filter((c) => c.isArchived !== true)
      .map((c) => c.code.toUpperCase()),
  );
  for (const cb of matchingCashboxes) {
    const balances = normalizeBalancesRecord(cb.balances);
    for (const code of Object.keys(balances)) {
      observedCurrencies.add(code.toUpperCase());
    }
  }
  for (const tx of activeTxs) {
    if (tx.currency) observedCurrencies.add(String(tx.currency).toUpperCase());
  }

  const orderedCurrencies = Array.from(observedCurrencies).sort((a, b) => {
    if (a === 'UAH') return -1;
    if (b === 'UAH') return 1;
    return a.localeCompare(b);
  });
  const activeCurrencies =
    currencyFilter && currencyFilter !== 'ALL'
      ? orderedCurrencies.filter((c) => c === currencyFilter)
      : orderedCurrencies;

  // Determine seal/purge coverage
  const sealedDateKey = activeSnapshot?.periodEnd
    ? formatKievDateKey(activeSnapshot.periodEnd)
    : null;
  const purgedTxCount = Number(activeSnapshot?.purgedTxCount ?? 0);
  const purgedBeforeSeal = Boolean(activeSnapshot && purgedTxCount > 0);
  const reconciliationUnavailableBySeal = Boolean(
    purgedBeforeSeal &&
      sealedDateKey &&
      (!current.dateFrom || current.dateFrom <= sealedDateKey),
  );

  // Build cashbox current balance lookup
  const getCurrentCashboxBalance = (cb: CashboxDocument, code: string) =>
    resolveCashboxCurrencyBalance({ balances: cb.balances }, code);

  // Compute period inflows, outflows, transfers, and reconciliation strictly per currency
  const matchesTxNonDateFilters = (tx: FinanceTransactionDocument) => {
    if (typeFilter && typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (
      categoryFilter &&
      String(tx.category ?? '').toLowerCase() !== categoryFilter
    ) {
      return false;
    }
    if (searchQuery) {
      const hay = `${tx.note ?? ''} ${tx.category ?? ''}`.toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    if (cashboxFilter) {
      const fromId = tx.fromCashbox ? tx.fromCashbox.toString() : '';
      const toId = tx.toCashbox ? tx.toCashbox.toString() : '';
      if (fromId !== cashboxFilter && toId !== cashboxFilter) return false;
    }
    return true;
  };

  const computeWindowSummaryForCurrency = (
    code: string,
    dateFrom: string | null,
    dateTo: string | null,
  ) => {
    let inflows = 0;
    let outflows = 0;
    let inflowsCount = 0;
    let outflowsCount = 0;
    let transfersVolume = 0;
    let transfersCount = 0;
    let transfersIn = 0;
    let transfersOut = 0;

    const dailyMap = new Map<
      string,
      { inflows: number; outflows: number; transfers: number }
    >();

    for (const tx of activeTxs) {
      if (String(tx.currency ?? 'UAH').toUpperCase() !== code) continue;
      if (!matchesTxNonDateFilters(tx)) continue;
      const dateKey = formatKievDateKey(tx.transactionDate ?? tx.createdAt);
      if (!isDateKeyInsideRange(dateKey, dateFrom, dateTo)) continue;

      const amt = Math.max(Number(tx.amount ?? 0), 0);
      const day = dailyMap.get(dateKey) ?? {
        inflows: 0,
        outflows: 0,
        transfers: 0,
      };

      if (tx.type === 'deposit') {
        inflows = roundMoney(inflows + amt);
        inflowsCount += 1;
        day.inflows = roundMoney(day.inflows + amt);
      } else if (tx.type === 'withdraw') {
        outflows = roundMoney(outflows + amt);
        outflowsCount += 1;
        day.outflows = roundMoney(day.outflows + amt);
      } else if (tx.type === 'transfer') {
        transfersVolume = roundMoney(transfersVolume + amt);
        transfersCount += 1;
        day.transfers = roundMoney(day.transfers + amt);
        if (cashboxFilter) {
          if (tx.toCashbox?.toString() === cashboxFilter) {
            transfersIn = roundMoney(transfersIn + amt);
          }
          if (tx.fromCashbox?.toString() === cashboxFilter) {
            transfersOut = roundMoney(transfersOut + amt);
          }
        }
      }
      dailyMap.set(dateKey, day);
    }

    return {
      currency: code,
      inflows,
      outflows,
      netExternalCashflow: roundMoney(inflows - outflows),
      inflowsCount,
      outflowsCount,
      transfersVolume,
      transfersCount,
      transfersIn,
      transfersOut,
      dailyMap,
    };
  };

  // Reverse-walk reconciliation per currency across matching cashboxes
  const reconcileCurrencyBalances = (code: string) => {
    const currentTotal = roundMoney(
      matchingCashboxes.reduce((sum, cb) => sum + getCurrentCashboxBalance(cb, code), 0),
    );

    if (!current.dateFrom || !current.dateTo || reconciliationUnavailableBySeal) {
      const perCashbox = matchingCashboxes.map((cb) => ({
        cashboxId: cb._id.toString(),
        name: cb.name,
        currency: code,
        currentBalance: getCurrentCashboxBalance(cb, code),
        openingBalance: null as number | null,
        closingBalance: null as number | null,
        inflows: 0,
        outflows: 0,
        transfersIn: 0,
        transfersOut: 0,
        reconciliationDelta: null as number | null,
      }));
      return {
        currentBalance: currentTotal,
        openingBalance: null as number | null,
        closingBalance: null as number | null,
        reconciliationDelta: null as number | null,
        reconciled: false,
        complete: !reconciliationUnavailableBySeal && Boolean(current.dateFrom && current.dateTo),
        perCashbox,
      };
    }

    const closingByCb = new Map<string, number>(
      matchingCashboxes.map((cb) => [cb._id.toString(), getCurrentCashboxBalance(cb, code)]),
    );

    // Reverse transactions strictly AFTER dateTo
    for (const tx of activeTxs) {
      if (String(tx.currency ?? 'UAH').toUpperCase() !== code) continue;
      const dateKey = formatKievDateKey(tx.transactionDate ?? tx.createdAt);
      if (!dateKey || dateKey <= current.dateTo) continue;

      const amt = Number(tx.amount ?? 0);
      const fromId = tx.fromCashbox ? tx.fromCashbox.toString() : '';
      const toId = tx.toCashbox ? tx.toCashbox.toString() : '';

      if (tx.type === 'deposit' && toId && closingByCb.has(toId)) {
        closingByCb.set(toId, roundMoney((closingByCb.get(toId) ?? 0) - amt));
      } else if (tx.type === 'withdraw' && fromId && closingByCb.has(fromId)) {
        closingByCb.set(fromId, roundMoney((closingByCb.get(fromId) ?? 0) + amt));
      } else if (tx.type === 'transfer') {
        if (fromId && closingByCb.has(fromId)) {
          closingByCb.set(fromId, roundMoney((closingByCb.get(fromId) ?? 0) + amt));
        }
        if (toId && closingByCb.has(toId)) {
          closingByCb.set(toId, roundMoney((closingByCb.get(toId) ?? 0) - amt));
        }
      }
    }

    const openingByCb = new Map(closingByCb);
    const periodFlows = new Map(
      matchingCashboxes.map((cb) => [
        cb._id.toString(),
        { inflows: 0, outflows: 0, transfersIn: 0, transfersOut: 0 },
      ]),
    );

    for (const tx of activeTxs) {
      if (String(tx.currency ?? 'UAH').toUpperCase() !== code) continue;
      const dateKey = formatKievDateKey(tx.transactionDate ?? tx.createdAt);
      if (!isDateKeyInsideRange(dateKey, current.dateFrom, current.dateTo)) continue;

      const amt = Number(tx.amount ?? 0);
      const fromId = tx.fromCashbox ? tx.fromCashbox.toString() : '';
      const toId = tx.toCashbox ? tx.toCashbox.toString() : '';

      if (tx.type === 'deposit' && toId && openingByCb.has(toId)) {
        openingByCb.set(toId, roundMoney((openingByCb.get(toId) ?? 0) - amt));
        periodFlows.get(toId)!.inflows = roundMoney(
          periodFlows.get(toId)!.inflows + amt,
        );
      } else if (tx.type === 'withdraw' && fromId && openingByCb.has(fromId)) {
        openingByCb.set(fromId, roundMoney((openingByCb.get(fromId) ?? 0) + amt));
        periodFlows.get(fromId)!.outflows = roundMoney(
          periodFlows.get(fromId)!.outflows + amt,
        );
      } else if (tx.type === 'transfer') {
        if (fromId && openingByCb.has(fromId)) {
          openingByCb.set(fromId, roundMoney((openingByCb.get(fromId) ?? 0) + amt));
          periodFlows.get(fromId)!.transfersOut = roundMoney(
            periodFlows.get(fromId)!.transfersOut + amt,
          );
        }
        if (toId && openingByCb.has(toId)) {
          openingByCb.set(toId, roundMoney((openingByCb.get(toId) ?? 0) - amt));
          periodFlows.get(toId)!.transfersIn = roundMoney(
            periodFlows.get(toId)!.transfersIn + amt,
          );
        }
      }
    }

    const perCashbox = matchingCashboxes.map((cb) => {
      const id = cb._id.toString();
      const opening = openingByCb.get(id) ?? 0;
      const closing = closingByCb.get(id) ?? 0;
      const f = periodFlows.get(id)!;
      const expectedClosing = roundMoney(
        opening + f.inflows - f.outflows + f.transfersIn - f.transfersOut,
      );
      return {
        cashboxId: id,
        name: cb.name,
        currency: code,
        currentBalance: getCurrentCashboxBalance(cb, code),
        openingBalance: opening,
        closingBalance: closing,
        inflows: f.inflows,
        outflows: f.outflows,
        transfersIn: f.transfersIn,
        transfersOut: f.transfersOut,
        reconciliationDelta: roundMoney(closing - expectedClosing),
      };
    });

    const totalOpening = roundMoney(
      perCashbox.reduce((s, r) => s + (r.openingBalance ?? 0), 0),
    );
    const totalClosing = roundMoney(
      perCashbox.reduce((s, r) => s + (r.closingBalance ?? 0), 0),
    );
    const sumIn = roundMoney(perCashbox.reduce((s, r) => s + r.inflows, 0));
    const sumOut = roundMoney(perCashbox.reduce((s, r) => s + r.outflows, 0));
    const sumTIn = roundMoney(perCashbox.reduce((s, r) => s + r.transfersIn, 0));
    const sumTOut = roundMoney(perCashbox.reduce((s, r) => s + r.transfersOut, 0));
    const netTransferBetweenSelected = roundMoney(sumTIn - sumTOut);
    const expectedTotalClosing = roundMoney(
      totalOpening + sumIn - sumOut + netTransferBetweenSelected,
    );
    const totalDelta = roundMoney(totalClosing - expectedTotalClosing);

    return {
      currentBalance: currentTotal,
      openingBalance: totalOpening,
      closingBalance: totalClosing,
      reconciliationDelta: totalDelta,
      reconciled: Math.abs(totalDelta) < 0.01,
      complete: true,
      perCashbox,
    };
  };

  // Unscheduled outstanding obligations (payable supplier orders + unpaid client orders in UAH)
  const scheduledObligationKeys = new Set(
    plannedEvents
      .filter((evt) => evt.obligationKind && evt.obligationId && evt.scheduledDate)
      .map((evt) => `${evt.obligationKind}:${evt.obligationId}`),
  );

  const rawObligations: Array<{
    obligationKind: 'supplier_order' | 'sale_balance';
    obligationId: string;
    label: string;
    type: 'inflow' | 'outflow';
    currency: string;
    amount: number;
    dueDate: string | null;
    isScheduled: boolean;
  }> = [];

  for (const order of openSupplierOrders) {
    const remaining = roundMoney(Math.max((order.total ?? 0) - (order.paid ?? 0), 0));
    if (remaining <= 0) continue;
    const oid = order._id.toString();
    rawObligations.push({
      obligationKind: 'supplier_order',
      obligationId: oid,
      label: `Supplier order ${order.number?.trim() || order.orderBaseId}`,
      type: 'outflow',
      currency: 'UAH',
      amount: remaining,
      dueDate: order.deliveryDate ? formatKievDateKey(order.deliveryDate) : null,
      isScheduled: scheduledObligationKeys.has(`supplier_order:${oid}`),
    });
  }

  for (const sale of unpaidSales) {
    const total = getSaleDocumentTotal(sale);
    const remaining = roundMoney(Math.max(total - Number(sale.paidAmount ?? 0), 0));
    if (remaining <= 0) continue;
    const sid = sale._id.toString();
    rawObligations.push({
      obligationKind: 'sale_balance',
      obligationId: sid,
      label: `Order ${sale.recordNumber ?? sid} (${sale.clientSnapshot?.name ?? 'Client'})`,
      type: 'inflow',
      currency: 'UAH',
      amount: remaining,
      dueDate: formatKievDateKey(sale.saleDate),
      isScheduled: scheduledObligationKeys.has(`sale_balance:${sid}`),
    });
  }

  const unscheduledObligations = rawObligations.filter((o) => !o.isScheduled);

  // Per-currency summaries + 30/60/90 cash forecast
  const earliestTx =
    activeTxs.length > 0 ? activeTxs[activeTxs.length - 1] : null;
  const earliestTxKey = earliestTx
    ? formatKievDateKey(earliestTx.transactionDate ?? earliestTx.createdAt)
    : null;
  const observedHistoryDays = earliestTxKey
    ? Math.min(Math.max(diffCalendarDaysInclusive(earliestTxKey, todayKey), 0), 90)
    : 0;
  const forecastTruncatedBySeal = Boolean(
    purgedBeforeSeal && sealedDateKey && trailStartKey <= sealedDateKey,
  );

  const byCurrency: Record<string, unknown> = {};

  for (const code of activeCurrencies) {
    const cur = computeWindowSummaryForCurrency(
      code,
      current.dateFrom,
      current.dateTo,
    );
    const prev = previous
      ? computeWindowSummaryForCurrency(code, previous.dateFrom, previous.dateTo)
      : null;
    const reconciliation = reconcileCurrencyBalances(code);

    const dateKeys =
      current.dateFrom && current.dateTo
        ? listCalendarDateKeys(current.dateFrom, current.dateTo)
        : Array.from(cur.dailyMap.keys()).sort();
    const trend = dateKeys.map((dateKey) => {
      const day = cur.dailyMap.get(dateKey);
      return {
        dateKey,
        inflows: day?.inflows ?? 0,
        outflows: day?.outflows ?? 0,
        netExternal: roundMoney((day?.inflows ?? 0) - (day?.outflows ?? 0)),
        transfers: day?.transfers ?? 0,
      };
    });

    // Trailing 90d external inflows & outflows (excluding transfers & unsealed filter)
    let trailInflow90d = 0;
    let trailOutflow90d = 0;
    for (const tx of activeTxs) {
      if (String(tx.currency ?? 'UAH').toUpperCase() !== code) continue;
      if (cashboxFilter) {
        const fromId = tx.fromCashbox ? tx.fromCashbox.toString() : '';
        const toId = tx.toCashbox ? tx.toCashbox.toString() : '';
        if (fromId !== cashboxFilter && toId !== cashboxFilter) continue;
      }
      const key = formatKievDateKey(tx.transactionDate ?? tx.createdAt);
      if (!key || key < trailStartKey || key > todayKey) continue;
      const amt = Math.max(Number(tx.amount ?? 0), 0);
      if (tx.type === 'deposit') trailInflow90d += amt;
      else if (tx.type === 'withdraw') trailOutflow90d += amt;
    }

    const avgDailyInflow = roundMoney(trailInflow90d / 90);
    const avgDailyOutflow = roundMoney(trailOutflow90d / 90);
    const baseDailyInflow = roundMoney(
      avgDailyInflow * inflowMultiplier * demandMultiplier,
    );
    const baseDailyOutflow = roundMoney(avgDailyOutflow * outflowMultiplier);

    const eventsByDate = new Map<string, { inflow: number; outflow: number }>();
    const horizonEndKey = addCalendarDays(todayKey, horizonDays);
    for (const evt of plannedEvents) {
      if (evt.currency !== code) continue;
      if (!evt.scheduledDate || evt.scheduledDate <= todayKey || evt.scheduledDate > horizonEndKey) {
        continue;
      }
      const bucket = eventsByDate.get(evt.scheduledDate) ?? {
        inflow: 0,
        outflow: 0,
      };
      if (evt.type === 'inflow') bucket.inflow = roundMoney(bucket.inflow + evt.amount);
      else bucket.outflow = roundMoney(bucket.outflow + evt.amount);
      eventsByDate.set(evt.scheduledDate, bucket);
    }

    let runningBalance = reconciliation.currentBalance;
    let totalProjectedInflows = 0;
    let totalProjectedOutflows = 0;
    let totalPlannedInflows = 0;
    let totalPlannedOutflows = 0;
    let lowestProjectedBalance = runningBalance;

    const projectionSeries: Array<{
      day: number;
      dateKey: string;
      baselineInflow: number;
      baselineOutflow: number;
      plannedInflow: number;
      plannedOutflow: number;
      projectedBalance: number;
    }> = [];

    for (let dayNum = 1; dayNum <= horizonDays; dayNum += 1) {
      const dateKey = addCalendarDays(todayKey, dayNum);
      // Timing shifts: positive shifts delay baseline flows by N days; negative pulls N days forward at day 1
      let dayBaselineInflow: number;
      if (inflowTimingShiftDays >= 0) {
        dayBaselineInflow = dayNum > inflowTimingShiftDays ? baseDailyInflow : 0;
      } else {
        const pullExtra = dayNum === 1 ? Math.min(Math.abs(inflowTimingShiftDays), horizonDays) : 0;
        const tailCutoff = horizonDays - Math.min(Math.abs(inflowTimingShiftDays), horizonDays);
        dayBaselineInflow =
          (dayNum <= tailCutoff ? baseDailyInflow : 0) +
          roundMoney(pullExtra * baseDailyInflow);
      }

      let dayBaselineOutflow: number;
      if (outflowTimingShiftDays >= 0) {
        dayBaselineOutflow = dayNum > outflowTimingShiftDays ? baseDailyOutflow : 0;
      } else {
        const pullExtra = dayNum === 1 ? Math.min(Math.abs(outflowTimingShiftDays), horizonDays) : 0;
        const tailCutoff = horizonDays - Math.min(Math.abs(outflowTimingShiftDays), horizonDays);
        dayBaselineOutflow =
          (dayNum <= tailCutoff ? baseDailyOutflow : 0) +
          roundMoney(pullExtra * baseDailyOutflow);
      }

      const evts = eventsByDate.get(dateKey) ?? { inflow: 0, outflow: 0 };
      totalProjectedInflows = roundMoney(totalProjectedInflows + dayBaselineInflow);
      totalProjectedOutflows = roundMoney(totalProjectedOutflows + dayBaselineOutflow);
      totalPlannedInflows = roundMoney(totalPlannedInflows + evts.inflow);
      totalPlannedOutflows = roundMoney(totalPlannedOutflows + evts.outflow);

      runningBalance = roundMoney(
        runningBalance +
          dayBaselineInflow -
          dayBaselineOutflow +
          evts.inflow -
          evts.outflow,
      );
      if (runningBalance < lowestProjectedBalance) {
        lowestProjectedBalance = runningBalance;
      }

      projectionSeries.push({
        day: dayNum,
        dateKey,
        baselineInflow: dayBaselineInflow,
        baselineOutflow: dayBaselineOutflow,
        plannedInflow: evts.inflow,
        plannedOutflow: evts.outflow,
        projectedBalance: runningBalance,
      });
    }

    byCurrency[code] = {
      currency: code,
      currentBalance: reconciliation.currentBalance,
      inflows: cur.inflows,
      outflows: cur.outflows,
      netExternalCashflow: cur.netExternalCashflow,
      inflowsCount: cur.inflowsCount,
      outflowsCount: cur.outflowsCount,
      transfersVolume: cur.transfersVolume,
      transfersCount: cur.transfersCount,
      transfersIn: cur.transfersIn,
      transfersOut: cur.transfersOut,
      reconciliation,
      comparison: prev
        ? {
            inflowsPrev: prev.inflows,
            outflowsPrev: prev.outflows,
            netExternalCashflowPrev: prev.netExternalCashflow,
            inflowsDeltaPct:
              prev.inflows > 0
                ? round1(((cur.inflows - prev.inflows) / prev.inflows) * 100)
                : null,
            outflowsDeltaPct:
              prev.outflows > 0
                ? round1(((cur.outflows - prev.outflows) / prev.outflows) * 100)
                : null,
          }
        : null,
      trend,
      forecast: {
        isEstimate: true,
        horizonDays,
        startingBalance: reconciliation.currentBalance,
        avgDailyInflow,
        avgDailyOutflow,
        adjustedDailyInflow: baseDailyInflow,
        adjustedDailyOutflow: baseDailyOutflow,
        totalProjectedBaselineInflows: totalProjectedInflows,
        totalProjectedBaselineOutflows: totalProjectedOutflows,
        totalPlannedInflows,
        totalPlannedOutflows,
        endingProjectedBalance: runningBalance,
        lowestProjectedBalance,
        series: projectionSeries,
      },
    };
  }

  const warnings: string[] = [];
  const warningItems: Array<{ code: string; count?: number; date?: string }> = [];
  if (reconciliationUnavailableBySeal) {
    warnings.push(
      `Transactions on or before ${sealedDateKey} (${purgedTxCount} purged) are sealed; opening balance and full period reconciliation are unavailable inside the sealed purge window.`,
    );
    warningItems.push({
      code: 'sealedPurge',
      date: sealedDateKey ?? undefined,
      count: purgedTxCount,
    });
  }
  if (forecastTruncatedBySeal) {
    warnings.push(
      `Trailing 90-day forecast history partially overlaps purged seal date (${sealedDateKey}).`,
    );
    warningItems.push({
      code: 'forecastTruncatedBySeal',
      date: sealedDateKey ?? undefined,
    });
  } else if (observedHistoryDays < 90) {
    warnings.push(
      `Only ${observedHistoryDays} day(s) of finance history available inside the 90-day observation window.`,
    );
    warningItems.push({ code: 'shortFinanceHistory', count: observedHistoryDays });
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
    currencies: activeCurrencies,
    allCurrencies: orderedCurrencies,
    cashboxes: matchingCashboxes.map((cb) => ({
      id: cb._id.toString(),
      name: cb.name,
      balances: cb.balances ?? {},
      isArchived: cb.isArchived === true,
    })),
    byCurrency,
    assumptions: {
      horizonDays,
      demandMultiplier,
      inflowMultiplier,
      outflowMultiplier,
      inflowTimingShiftDays,
      outflowTimingShiftDays,
      plannedEvents,
    },
    unscheduledObligations,
    obligationSummary: {
      unscheduledPayablesTotal: roundMoney(
        unscheduledObligations
          .filter((o) => o.type === 'outflow')
          .reduce((s, o) => s + o.amount, 0),
      ),
      unscheduledReceivablesTotal: roundMoney(
        unscheduledObligations
          .filter((o) => o.type === 'inflow')
          .reduce((s, o) => s + o.amount, 0),
      ),
      unscheduledCount: unscheduledObligations.length,
      scheduledCount: rawObligations.length - unscheduledObligations.length,
    },
    coverage: {
      sealedThrough: sealedDateKey,
      purgedBeforeSeal,
      purgedTxCount,
      reconciliationUnavailableBySeal,
      observedHistoryDays,
      historyWindowDays: 90,
      warnings,
      warningItems,
    },
  };
};

export const getCashboxesReportDetails = async (
  query: CashboxesReportQuery = {},
  now: Date = new Date(),
) => {
  const { current } = resolveBoundedPeriodWithPrevious(query, {
    defaultPeriod: 'last30',
    now,
  });

  const [cashboxes, transactions] = await Promise.all([
    Cashbox.find({}).select({ _id: 1, name: 1 }).lean(),
    FinanceTransaction.find({ status: { $ne: 'cancelled' }, isCancellation: { $ne: true } })
      .sort({ transactionDate: -1, createdAt: -1 })
      .lean<FinanceTransactionDocument[]>(),
  ]);

  const cashboxNameMap = new Map(cashboxes.map((c) => [c._id.toString(), c.name]));
  const cashboxFilter = String(query.cashboxId ?? '').trim();
  const currencyFilter = String(query.currency ?? '').trim().toUpperCase();
  const typeFilter = String(query.type ?? 'all').trim().toLowerCase();
  const categoryFilter = String(query.category ?? '').trim().toLowerCase();
  const searchQuery = String(query.q ?? '').trim().toLowerCase();

  const matching = transactions
    .filter((tx) => {
      const dateKey = formatKievDateKey(tx.transactionDate ?? tx.createdAt);
      if (!isDateKeyInsideRange(dateKey, current.dateFrom, current.dateTo)) {
        return false;
      }
      if (
        currencyFilter &&
        currencyFilter !== 'ALL' &&
        String(tx.currency ?? 'UAH').toUpperCase() !== currencyFilter
      ) {
        return false;
      }
      if (typeFilter && typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (
        categoryFilter &&
        String(tx.category ?? '').toLowerCase() !== categoryFilter
      ) {
        return false;
      }
      const fromId = tx.fromCashbox ? tx.fromCashbox.toString() : '';
      const toId = tx.toCashbox ? tx.toCashbox.toString() : '';
      if (cashboxFilter && fromId !== cashboxFilter && toId !== cashboxFilter) {
        return false;
      }
      if (searchQuery) {
        const fromName = fromId ? cashboxNameMap.get(fromId) ?? '' : '';
        const toName = toId ? cashboxNameMap.get(toId) ?? '' : '';
        const hay = `${tx.note ?? ''} ${tx.category ?? ''} ${fromName} ${toName}`.toLowerCase();
        if (!hay.includes(searchQuery)) return false;
      }
      return true;
    })
    .map((tx) => {
      const fromId = tx.fromCashbox ? tx.fromCashbox.toString() : null;
      const toId = tx.toCashbox ? tx.toCashbox.toString() : null;
      return {
        id: tx._id.toString(),
        type: tx.type,
        amount: tx.amount,
        currency: String(tx.currency ?? 'UAH').toUpperCase(),
        category: tx.category ?? '',
        fromCashboxId: fromId,
        fromCashboxName: fromId ? cashboxNameMap.get(fromId) ?? 'Cashbox' : null,
        toCashboxId: toId,
        toCashboxName: toId ? cashboxNameMap.get(toId) ?? 'Cashbox' : null,
        note: tx.note ?? '',
        transactionDate: new Date(tx.transactionDate ?? tx.createdAt).toISOString(),
      };
    });

  const sortBy = String(query.sortBy ?? 'transactionDate').trim();
  const sortDir = String(query.sortDir ?? 'desc').trim().toLowerCase() === 'asc' ? 1 : -1;
  matching.sort((a, b) => {
    if (sortBy === 'amount') return (a.amount - b.amount) * sortDir;
    if (sortBy === 'type') return a.type.localeCompare(b.type) * sortDir;
    return a.transactionDate.localeCompare(b.transactionDate) * sortDir;
  });

  const page = clampInt(query.page, 1, 1, 10000);
  const pageSize = clampInt(query.pageSize, 25, 1, 200);
  const skip = (page - 1) * pageSize;

  return {
    items: matching.slice(skip, skip + pageSize),
    total: matching.length,
    page,
    pageSize,
  };
};
