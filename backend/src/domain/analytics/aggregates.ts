export const FUNNEL_STATUSES = [
  'new',
  'diagnostics',
  'waitingParts',
  'clientApproved',
  'inRepair',
  'refinement',
  'ready',
  'paid',
] as const;

export type FunnelStatus = (typeof FUNNEL_STATUSES)[number] | 'other';

export type DateBounds = { start: Date; end: Date };

export type TopLineItem = {
  key: string;
  name: string;
  quantity: number;
  amount: number;
};

type PaymentEntryLike = {
  type?: string;
  paymentMethod?: string;
  amount?: number;
};

type LineItemLike = {
  kind?: string;
  name?: string;
  productId?: unknown;
  serviceId?: unknown;
  price?: number;
  quantity?: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const toIsoDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

export const getDeltaPct = (current: number, previous: number) =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

export const isDateInBounds = (date: Date, bounds: DateBounds) =>
  date.getTime() >= bounds.start.getTime() && date.getTime() <= bounds.end.getTime();

export const getConsecutivePreviousBounds = (
  period: string,
  currentDate: Date,
  dateFrom?: string,
  dateTo?: string,
): DateBounds | null => {
  if (dateFrom || dateTo) {
    const fromKey = dateFrom ?? toIsoDateKey(currentDate);
    const toKey = dateTo ?? toIsoDateKey(currentDate);
    const from = new Date(`${fromKey}T00:00:00.000`);
    const to = new Date(`${toKey}T23:59:59.999`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    const start = from <= to ? from : to;
    const end = from <= to ? to : from;
    const daySpan = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
    const prevEnd = endOfLocalDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1));
    const prevStart = startOfLocalDay(
      new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - (daySpan - 1)),
    );
    return { start: prevStart, end: prevEnd };
  }

  if (period === 'whole') return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const day = currentDate.getDate();

  if (period === 'today') {
    const previous = new Date(year, month, day - 1);
    return { start: startOfLocalDay(previous), end: endOfLocalDay(previous) };
  }

  if (period === 'currentMonth') {
    return {
      start: new Date(year, month - 1, 1),
      end: endOfLocalDay(new Date(year, month, 0)),
    };
  }

  if (period === 'lastMonth') {
    return {
      start: new Date(year, month - 2, 1),
      end: endOfLocalDay(new Date(year, month - 1, 0)),
    };
  }

  if (period === 'currentYear') {
    return {
      start: new Date(year - 1, 0, 1),
      end: endOfLocalDay(new Date(year - 1, 11, 31)),
    };
  }

  if (period === 'lastYear') {
    return {
      start: new Date(year - 2, 0, 1),
      end: endOfLocalDay(new Date(year - 2, 11, 31)),
    };
  }

  return null;
};

export const getCashSplit = (
  records: Array<{ paidAmount?: number; paymentHistory?: PaymentEntryLike[] }>,
) => {
  let cash = 0;
  let nonCash = 0;
  let collected = 0;

  records.forEach((record) => {
    collected += Math.max(Number(record.paidAmount ?? 0), 0);
    (record.paymentHistory ?? []).forEach((entry) => {
      const amount = Math.max(Number(entry.amount ?? 0), 0);
      const signed = entry.type === 'refund' ? -amount : amount;
      if (entry.paymentMethod === 'non-cash') {
        nonCash += signed;
      } else if (entry.paymentMethod === 'cash') {
        cash += signed;
      }
    });
  });

  cash = Math.max(cash, 0);
  nonCash = Math.max(nonCash, 0);

  return {
    cashCollected: cash,
    nonCashCollected: nonCash,
    unspecifiedCollected: Math.max(collected - cash - nonCash, 0),
  };
};

export const getRepairFunnel = (
  repairOrders: Array<{ status?: string }>,
  isFinal: (sale: { status?: string }) => boolean,
) => {
  const open = repairOrders.filter((sale) => !isFinal(sale));
  const funnel: Array<{ status: FunnelStatus; count: number }> = FUNNEL_STATUSES.map(
    (status) => ({
      status,
      count: open.filter((sale) => sale.status === status).length,
    }),
  );
  const accounted = funnel.reduce((sum, item) => sum + item.count, 0);
  const other = open.length - accounted;
  if (other > 0) {
    funnel.push({ status: 'other', count: other });
  }
  return funnel;
};

const lineItemKey = (item: LineItemLike, kind: 'product' | 'service') => {
  const rawId = kind === 'service' ? item.serviceId : item.productId;
  const id = rawId == null ? '' : String(rawId);
  if (id && id !== 'undefined' && id !== 'null') {
    return `${kind}:${id}`;
  }
  const name = String(item.name ?? '').trim().toLowerCase();
  return `${kind}:name:${name || 'unknown'}`;
};

export const getTopLineItems = (
  records: Array<{ lineItems?: LineItemLike[] }>,
  limit = 5,
) => {
  const productMap = new Map<string, TopLineItem>();
  const serviceMap = new Map<string, TopLineItem>();

  records.forEach((record) => {
    (record.lineItems ?? []).forEach((item) => {
      const quantity = Number(item.quantity ?? 0);
      const amount = Number(item.price ?? 0) * quantity;
      if (quantity <= 0 && amount <= 0) return;
      const kind = item.kind === 'service' ? 'service' : 'product';
      const name = String(item.name ?? '').trim() || '—';
      const key = lineItemKey(item, kind);
      const map = kind === 'service' ? serviceMap : productMap;
      const current = map.get(key) ?? { key, name, quantity: 0, amount: 0 };
      current.quantity += quantity;
      current.amount += amount;
      if (name !== '—') current.name = name;
      map.set(key, current);
    });
  });

  const rank = (map: Map<string, TopLineItem>) =>
    [...map.values()]
      .sort((first, second) => second.amount - first.amount || second.quantity - first.quantity)
      .slice(0, limit);

  return {
    products: rank(productMap),
    services: rank(serviceMap),
  };
};
