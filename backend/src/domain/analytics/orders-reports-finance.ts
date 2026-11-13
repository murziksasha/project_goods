import { allocateLineRevenues } from '../finance/profit-report';
import type { ServiceProfitMode } from '../finance/model';
import {
  resolveLineItemEffectiveCost,
  type CostableSaleLineItem,
} from '../sale/costing';

export const roundMoney = (v: number) => Math.round(v * 100) / 100;
export const round1 = (v: number) => Math.round(v * 10) / 10;

export type LineLike = {
  id?: string;
  kind?: string;
  name?: string;
  price?: number;
  quantity?: number;
  productId?: unknown;
  catalogProductId?: unknown;
  serviceId?: unknown;
  costMethod?: 'fixed' | 'time_rate' | null;
  recordedMinutes?: number | null;
  fixedCost?: number | null;
  hourlyCost?: number | null;
  directExpenses?: number | null;
  unitCostOverride?: number | null;
  costSnapshot?: unknown;
  auditedCost?: unknown;
};

export type FinanceSaleLike = {
  kind?: string;
  salePrice?: number;
  quantity?: number;
  discount?: { mode?: string; value?: number } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lineItems?: any[] | null;
};

export type OrderFinanceFields = {
  knownCost: number;
  knownCostRevenue: number;
  knownProfit: number;
  profit: number | null;
  marginPct: number | null;
  isIncomplete: boolean;
  missingCostCount: number;
};

export type LineFinance = {
  kind: 'product' | 'service';
  name: string;
  quantity: number;
  net: number;
  costKnown: boolean;
  knownCost: number;
};

const toId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'toString' in value) {
    return String((value as { toString: () => string }).toString());
  }
  return String(value);
};

export const getSaleLines = (sale: FinanceSaleLike): LineLike[] => {
  if (Array.isArray(sale.lineItems) && sale.lineItems.length > 0) {
    return sale.lineItems;
  }
  return [
    {
      kind: sale.kind === 'repair' ? 'service' : 'product',
      name: sale.kind === 'repair' ? 'Repair' : 'Sale',
      price: Number(sale.salePrice ?? 0),
      quantity: Number(sale.quantity ?? 1),
    },
  ];
};

const toCostable = (item: LineLike, index: number): CostableSaleLineItem => {
  const type = item.kind === 'service' ? 'service' : 'product';
  return {
    id: String(item.id ?? `${type}-${index}`),
    kind: type,
    productId: toId(item.productId) || null,
    catalogProductId: toId(item.catalogProductId) || null,
    serviceId: toId(item.serviceId) || null,
    name: String(item.name ?? ''),
    price: Number(item.price ?? 0),
    quantity: Number(item.quantity ?? 0),
    costMethod: item.costMethod ?? null,
    recordedMinutes: item.recordedMinutes ?? null,
    fixedCost: item.fixedCost ?? null,
    hourlyCost: item.hourlyCost ?? null,
    directExpenses: item.directExpenses ?? null,
    unitCostOverride: item.unitCostOverride ?? null,
    costSnapshot: item.costSnapshot as CostableSaleLineItem['costSnapshot'],
    auditedCost: item.auditedCost as CostableSaleLineItem['auditedCost'],
  };
};

const evaluateLine = (
  item: LineLike,
  index: number,
  productPriceMap: Map<string, number | null>,
  serviceProfitMode: ServiceProfitMode,
): { included: false } | { included: true; costKnown: boolean; cost: number; type: 'product' | 'service' } => {
  const type = item.kind === 'service' ? 'service' : 'product';
  if (type === 'service' && serviceProfitMode === 'exclude') {
    return { included: false };
  }
  if (type === 'service' && serviceProfitMode === 'revenue_only') {
    return { included: true, costKnown: false, cost: 0, type };
  }
  const resolved = resolveLineItemEffectiveCost(
    toCostable(item, index),
    productPriceMap,
  );
  const costKnown = resolved.status === 'known';
  return {
    included: true,
    costKnown,
    cost: costKnown ? roundMoney(Number(resolved.totalCost ?? 0)) : 0,
    type,
  };
};

export const computeLineFinances = (
  sale: FinanceSaleLike,
  productPriceMap: Map<string, number | null> = new Map(),
  serviceProfitMode: ServiceProfitMode = 'full',
): LineFinance[] => {
  const items = getSaleLines(sale);
  const revenues = allocateLineRevenues(
    items.map((item) => ({
      price: Number(item.price ?? 0),
      quantity: Number(item.quantity ?? 0),
    })),
    sale.discount,
  );
  const out: LineFinance[] = [];
  items.forEach((item, idx) => {
    const evaluation = evaluateLine(item, idx, productPriceMap, serviceProfitMode);
    if (!evaluation.included) return;
    out.push({
      kind: evaluation.type,
      name: String(item.name ?? '').trim() || evaluation.type,
      quantity: Math.max(Number(item.quantity ?? 0), 0),
      net: roundMoney(revenues[idx] ?? 0),
      costKnown: evaluation.costKnown,
      knownCost: evaluation.cost,
    });
  });
  return out;
};

export const computeOrderFinance = (
  sale: FinanceSaleLike,
  productPriceMap: Map<string, number | null> = new Map(),
  serviceProfitMode: ServiceProfitMode = 'full',
): OrderFinanceFields => {
  const lines = computeLineFinances(sale, productPriceMap, serviceProfitMode);
  let revenue = 0;
  let knownCostRevenue = 0;
  let knownCost = 0;
  let unknownLines = 0;

  for (const line of lines) {
    revenue = roundMoney(revenue + line.net);
    if (line.costKnown) {
      knownCostRevenue = roundMoney(knownCostRevenue + line.net);
      knownCost = roundMoney(knownCost + line.knownCost);
    } else {
      unknownLines += 1;
    }
  }

  const isIncomplete = unknownLines > 0;
  const knownProfit = roundMoney(knownCostRevenue - knownCost);
  const profit = isIncomplete ? null : roundMoney(revenue - knownCost);
  const marginPct =
    !isIncomplete && revenue > 0 && profit !== null
      ? roundMoney((profit / revenue) * 100)
      : null;

  return {
    knownCost,
    knownCostRevenue,
    knownProfit,
    profit,
    marginPct,
    isIncomplete,
    missingCostCount: unknownLines,
  };
};

export const publicFinanceFields = (finance: OrderFinanceFields) => ({
  knownCost: finance.knownCost,
  knownProfit: finance.knownProfit,
  marginPct: finance.marginPct,
  isIncomplete: finance.isIncomplete,
  missingCostCount: finance.missingCostCount,
});
