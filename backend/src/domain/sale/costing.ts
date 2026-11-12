import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import type { ProductDocument } from '../product/model';
import { ServiceCatalog, type ServiceCatalogDocument } from '../service-catalog/model';
import { Product } from '../product/model';
import { Sale, type SaleDocument } from './model';
import { HttpError } from '../../shared/lib/errors';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { formatSale } from '../../shared/lib/formatters';
import type { EmployeeDocument } from '../employee/model';
import type { EmployeePermission } from '../employee/constants';
import { employeeHasPermission } from '../auth/service';
import { getFinancePolicy } from '../finance/policy';
import {
  isStockCommittedRepairStatus,
  isStockCommittedSaleStatus,
  type SaleLineItem,
} from './stock';

export type LineCostStatus = 'known' | 'unknown';

export type LineCostMethod =
  | 'stock'
  | 'fixed'
  | 'time_rate'
  | 'manual'
  | 'zero'
  | 'unknown';

export type ServiceCostMethod = 'fixed' | 'time_rate';

export type CostSnapshotValue = {
  status: LineCostStatus;
  unitCost: number | null;
  totalCost: number | null;
  method: LineCostMethod;
  laborCost: number | null;
  directExpenses: number | null;
  recordedMinutes: number | null;
  hourlyCost: number | null;
  fixedCost: number | null;
  capturedAt: Date;
  capturedById: string | null;
  capturedByName: string | null;
};

export type CostAuditEntryValue = {
  id: string;
  previousStatus: LineCostStatus;
  previousUnitCost: number | null;
  previousTotalCost: number | null;
  newStatus: LineCostStatus;
  newUnitCost: number | null;
  newTotalCost: number | null;
  method: LineCostMethod;
  directExpenses: number | null;
  recordedMinutes: number | null;
  hourlyCost: number | null;
  fixedCost: number | null;
  reason: string;
  authorId: string | null;
  authorName: string;
  changedAt: Date;
};

export type StatusTransitionValue = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedById: string | null;
  changedByName: string | null;
  changedAt: Date;
};

export type ReturnEventValue = {
  id: string;
  lineItemId: string | null;
  name: string;
  productId: string | null;
  catalogProductId: string | null;
  quantity: number;
  grossAmount: number;
  refundAmount: number;
  unitCost: number | null;
  returnedAt: Date;
  returnedById: string | null;
  returnedByName: string | null;
};

export type CostableSaleLineItem = SaleLineItem & {
  id: string;
  costMethod?: ServiceCostMethod | null;
  recordedMinutes?: number | null;
  fixedCost?: number | null;
  hourlyCost?: number | null;
  directExpenses?: number | null;
  unitCostOverride?: number | null;
  isCostOverridden?: boolean | null;
  requiresCostAudit?: boolean | null;
  costSnapshot?: CostSnapshotValue | null;
  auditedCost?: CostSnapshotValue | null;
  costAuditLog?: CostAuditEntryValue[];
};

export type SaleCostWarnings = {
  hasMissingCosts: boolean;
  missingCostCount: number;
  missingCostLineItemIds: string[];
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const roundUnitCost = (value: number) => Math.round(value * 10000) / 10000;

const toOptionalNonNegativeNumber = (
  value: unknown,
  label: string,
): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, `${label} must be a non-negative number.`);
  }
  return roundMoney(parsed);
};

const toOptionalCostMethod = (
  value: unknown,
): ServiceCostMethod | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'fixed' || normalized === 'time_rate') {
    return normalized;
  }
  throw new HttpError(400, 'Line costMethod must be "fixed" or "time_rate".');
};

export const isStockCommittedStatusForKind = (kind: string, status: string) =>
  kind === 'sale'
    ? isStockCommittedSaleStatus(status)
    : isStockCommittedRepairStatus(status);

export const isRepairCompletedStatus = (status: string) => {
  const normalized = String(status ?? '').trim().toLowerCase();
  return (
    normalized === 'completed' ||
    normalized === 'issued' ||
    normalized === 'issuedwithoutrepair'
  );
};

export const employeeHasAllPermissions = (
  employee: Pick<EmployeeDocument, 'role' | 'permissions'> | null | undefined,
  permissions: readonly EmployeePermission[],
) => {
  if (!employee) return false;
  return permissions.every((perm) => employeeHasPermission(employee, perm));
};

export const canEmployeeOverrideSaleCosts = (
  employee: Pick<EmployeeDocument, 'role' | 'permissions'> | null | undefined,
  kind: string,
) => {
  if (!employee) return false;
  const managePerm: EmployeePermission =
    kind === 'repair' ? 'orders.manage' : 'sales.manage';
  return employeeHasAllPermissions(employee, [managePerm, 'finance.view']);
};

const numbersDiffer = (a: unknown, b: unknown) => {
  const normA = a === undefined || a === null || a === '' ? null : Number(a);
  const normB = b === undefined || b === null || b === '' ? null : Number(b);
  if (normA === null && normB === null) return false;
  if (normA === null || normB === null) return true;
  return Math.abs(normA - normB) > 0.0001;
};

const hasOwn = (obj: unknown, key: string) =>
  typeof obj === 'object' &&
  obj !== null &&
  Object.prototype.hasOwnProperty.call(obj, key);

const isEmptyFinancialValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0);

const toComparableIso = (value: unknown): string | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  ) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
};

const normalizeFinancialValue = (value: unknown): unknown => {
  if (isEmptyFinancialValue(value)) return null;
  const iso = toComparableIso(value);
  if (iso) return iso;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 10000) / 10000;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeFinancialValue);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const normalized = normalizeFinancialValue(obj[key]);
      if (normalized !== null) {
        next[key] = normalized;
      }
    }
    return next;
  }
  return value;
};

const financialValuesEqual = (incoming: unknown, existing: unknown): boolean => {
  if (isEmptyFinancialValue(incoming) && isEmptyFinancialValue(existing)) {
    return true;
  }
  return (
    JSON.stringify(normalizeFinancialValue(incoming)) ===
    JSON.stringify(normalizeFinancialValue(existing))
  );
};

export const assertNoUnauthorizedFinancialCostOverrides = ({
  kind,
  existingLineItems = [],
  incomingLineItems,
  employee,
  isCommitted = false,
}: {
  kind: string;
  existingLineItems?: CostableSaleLineItem[];
  incomingLineItems: Array<Record<string, unknown>>;
  employee?: Pick<EmployeeDocument, 'role' | 'permissions'> | null;
  isCommitted?: boolean;
}) => {
  if (!employee) return;
  if (canEmployeeOverrideSaleCosts(employee, kind)) return;

  const existingById = new Map(
    existingLineItems.map((item) => [String(item.id), item]),
  );

  for (const raw of incomingLineItems) {
    const existing = existingById.get(String(raw.id ?? ''));
    const overrideFields = [
      'unitCostOverride',
      'directExpenses',
      'fixedCost',
      'hourlyCost',
    ] as const;

    for (const field of overrideFields) {
      if (!hasOwn(raw, field) || raw[field] === undefined) continue;
      const incomingValue = raw[field];
      if (!existing) {
        if (incomingValue !== null && incomingValue !== '') {
          throw new HttpError(
            403,
            'Modifying financial cost overrides requires order/sale management and finance.view permissions.',
          );
        }
      } else if (
        incomingValue !== null &&
        incomingValue !== '' &&
        numbersDiffer(incomingValue, existing[field])
      ) {
        throw new HttpError(
          403,
          'Modifying financial cost overrides requires order/sale management and finance.view permissions.',
        );
      }
    }

    const assertUnchangedFinancialField = (
      field: 'costSnapshot' | 'auditedCost' | 'costAuditLog',
      message: string,
    ) => {
      if (!hasOwn(raw, field) || raw[field] === undefined) return;
      const incoming = raw[field];
      if (!existing) {
        if (!isEmptyFinancialValue(incoming)) {
          throw new HttpError(403, message);
        }
        return;
      }
      if (!financialValuesEqual(incoming, existing[field])) {
        throw new HttpError(403, message);
      }
    };

    assertUnchangedFinancialField(
      'costSnapshot',
      'Direct cost snapshot modifications require order/sale management and finance.view permissions.',
    );
    assertUnchangedFinancialField(
      'auditedCost',
      'Direct audited cost modifications require order/sale management and finance.view permissions.',
    );
    assertUnchangedFinancialField(
      'costAuditLog',
      'Direct cost audit log modifications are not permitted.',
    );

    if (
      hasOwn(raw, 'costMethod') &&
      raw.costMethod !== undefined &&
      raw.costMethod !== null &&
      existing &&
      existing.costMethod &&
      raw.costMethod !== existing.costMethod
    ) {
      throw new HttpError(
        403,
        'Overriding service costing method requires order/sale management and finance.view permissions.',
      );
    }

    if (
      isCommitted &&
      existing?.costSnapshot?.capturedAt &&
      hasOwn(raw, 'recordedMinutes') &&
      raw.recordedMinutes !== undefined &&
      numbersDiffer(raw.recordedMinutes, existing.recordedMinutes)
    ) {
      throw new HttpError(
        403,
        'Modifying recorded minutes on a cost-committed order requires order/sale management and finance.view permissions.',
      );
    }
  }
};

export const computeServiceSnapshotValues = ({
  quantity,
  costMethod,
  fixedCost,
  hourlyCost,
  recordedMinutes,
  directExpenses,
  unitCostOverride,
  actorId,
  actorName,
  capturedAt,
}: {
  quantity: number;
  costMethod: ServiceCostMethod;
  fixedCost: number | null;
  hourlyCost: number | null;
  recordedMinutes: number | null;
  directExpenses: number | null;
  unitCostOverride: number | null;
  actorId: string | null;
  actorName: string | null;
  capturedAt: Date;
}): CostSnapshotValue => {
  const safeQty = Math.max(Number(quantity) || 1, 1);
  const safeExpenses =
    directExpenses !== null && Number.isFinite(directExpenses)
      ? roundMoney(directExpenses)
      : null;

  if (unitCostOverride !== null && Number.isFinite(unitCostOverride)) {
    const laborCost = roundMoney(unitCostOverride * safeQty);
    const totalCost = roundMoney(laborCost + (safeExpenses ?? 0));
    return {
      status: 'known',
      unitCost: roundUnitCost(totalCost / safeQty),
      totalCost,
      method: totalCost === 0 ? 'zero' : 'manual',
      laborCost,
      directExpenses: safeExpenses,
      recordedMinutes,
      hourlyCost,
      fixedCost,
      capturedAt,
      capturedById: actorId,
      capturedByName: actorName,
    };
  }

  if (costMethod === 'time_rate') {
    if (
      hourlyCost !== null &&
      Number.isFinite(hourlyCost) &&
      recordedMinutes !== null &&
      Number.isFinite(recordedMinutes)
    ) {
      const laborCost = roundMoney((recordedMinutes / 60) * hourlyCost);
      const totalCost = roundMoney(laborCost + (safeExpenses ?? 0));
      return {
        status: 'known',
        unitCost: roundUnitCost(totalCost / safeQty),
        totalCost,
        method: 'time_rate',
        laborCost,
        directExpenses: safeExpenses,
        recordedMinutes,
        hourlyCost,
        fixedCost: null,
        capturedAt,
        capturedById: actorId,
        capturedByName: actorName,
      };
    }

    return {
      status: 'unknown',
      unitCost: null,
      totalCost: null,
      method: 'unknown',
      laborCost: null,
      directExpenses: safeExpenses,
      recordedMinutes,
      hourlyCost,
      fixedCost: null,
      capturedAt,
      capturedById: actorId,
      capturedByName: actorName,
    };
  }

  if (fixedCost !== null && Number.isFinite(fixedCost)) {
    const laborCost = roundMoney(fixedCost * safeQty);
    const totalCost = roundMoney(laborCost + (safeExpenses ?? 0));
    return {
      status: 'known',
      unitCost: roundUnitCost(totalCost / safeQty),
      totalCost,
      method: 'fixed',
      laborCost,
      directExpenses: safeExpenses,
      recordedMinutes,
      hourlyCost: null,
      fixedCost,
      capturedAt,
      capturedById: actorId,
      capturedByName: actorName,
    };
  }

  return {
    status: 'unknown',
    unitCost: null,
    totalCost: null,
    method: 'unknown',
    laborCost: null,
    directExpenses: safeExpenses,
    recordedMinutes,
    hourlyCost: null,
    fixedCost: null,
    capturedAt,
    capturedById: actorId,
    capturedByName: actorName,
  };
};

export const computeProductSnapshotValues = ({
  quantity,
  productPrice,
  directExpenses,
  unitCostOverride,
  actorId,
  actorName,
  capturedAt,
}: {
  quantity: number;
  productPrice: number | null;
  directExpenses: number | null;
  unitCostOverride: number | null;
  actorId: string | null;
  actorName: string | null;
  capturedAt: Date;
}): CostSnapshotValue => {
  const safeQty = Math.max(Number(quantity) || 1, 1);
  const safeExpenses =
    directExpenses !== null && Number.isFinite(directExpenses)
      ? roundMoney(directExpenses)
      : null;

  if (unitCostOverride !== null && Number.isFinite(unitCostOverride)) {
    const baseCost = roundMoney(unitCostOverride * safeQty);
    const totalCost = roundMoney(baseCost + (safeExpenses ?? 0));
    return {
      status: 'known',
      unitCost: roundUnitCost(totalCost / safeQty),
      totalCost,
      method: totalCost === 0 ? 'zero' : 'manual',
      laborCost: null,
      directExpenses: safeExpenses,
      recordedMinutes: null,
      hourlyCost: null,
      fixedCost: null,
      capturedAt,
      capturedById: actorId,
      capturedByName: actorName,
    };
  }

  if (productPrice !== null && Number.isFinite(productPrice) && productPrice >= 0) {
    const baseCost = roundMoney(productPrice * safeQty);
    const totalCost = roundMoney(baseCost + (safeExpenses ?? 0));
    return {
      status: 'known',
      unitCost: roundUnitCost(totalCost / safeQty),
      totalCost,
      method: 'stock',
      laborCost: null,
      directExpenses: safeExpenses,
      recordedMinutes: null,
      hourlyCost: null,
      fixedCost: null,
      capturedAt,
      capturedById: actorId,
      capturedByName: actorName,
    };
  }

  return {
    status: 'unknown',
    unitCost: null,
    totalCost: null,
    method: 'unknown',
    laborCost: null,
    directExpenses: safeExpenses,
    recordedMinutes: null,
    hourlyCost: null,
    fixedCost: null,
    capturedAt,
    capturedById: actorId,
    capturedByName: actorName,
  };
};

const canRunFind = (model: { find: unknown }) =>
  mongoose.connection.readyState !== 0 ||
  (typeof model.find === 'function' && 'mock' in model.find);

const canRunFindById = (model: { findById: unknown }) =>
  mongoose.connection.readyState !== 0 ||
  (typeof model.findById === 'function' && 'mock' in model.findById);

const loadCatalogServicesById = async (serviceIds: string[]) => {
  if (serviceIds.length === 0 || !canRunFind(ServiceCatalog)) {
    return [] as ServiceCatalogDocument[];
  }
  const query = ServiceCatalog.find({ _id: { $in: serviceIds } });
  if (query && typeof query.select === 'function') {
    return query
      .select({
        _id: 1,
        costMethod: 1,
        fixedCost: 1,
        hourlyCost: 1,
        defaultDurationMinutes: 1,
      })
      .lean<ServiceCatalogDocument[]>();
  }
  return [];
};

const loadProductsById = async (productIds: string[]) => {
  if (productIds.length === 0) return [] as ProductDocument[];
  if (canRunFind(Product)) {
    const query = Product.find({ _id: { $in: productIds } });
    if (query && typeof query.select === 'function') {
      return query.select({ _id: 1, price: 1 }).lean<ProductDocument[]>();
    }
  }
  if (canRunFindById(Product)) {
    const results = await Promise.all(
      productIds.map(async (id) => {
        const q = Product.findById(id) as unknown as {
          select?: (p: unknown) => { lean: () => Promise<ProductDocument | null> };
          lean?: () => Promise<ProductDocument | null>;
        };
        if (q && typeof q.select === 'function') {
          return q.select({ _id: 1, price: 1 }).lean();
        }
        if (q && typeof q.lean === 'function') {
          return q.lean();
        }
        return null;
      }),
    );
    return results.filter((doc): doc is ProductDocument => Boolean(doc));
  }
  return [] as ProductDocument[];
};

export const hasKnownProductPurchasePriceOnAdd = (
  lineItem: Pick<CostableSaleLineItem, 'kind' | 'productId' | 'unitCostOverride'>,
  productPriceById: Map<string, number | null> = new Map(),
): boolean => {
  if (lineItem.kind !== 'product') return false;
  if (
    lineItem.unitCostOverride !== undefined &&
    lineItem.unitCostOverride !== null &&
    Number.isFinite(Number(lineItem.unitCostOverride)) &&
    Number(lineItem.unitCostOverride) >= 0
  ) {
    return true;
  }
  if (lineItem.productId) {
    const stockPrice = productPriceById.get(String(lineItem.productId));
    if (
      typeof stockPrice === 'number' &&
      Number.isFinite(stockPrice) &&
      stockPrice >= 0
    ) {
      return true;
    }
  }
  return false;
};

export const hasKnownServiceCostOnAdd = (
  lineItem: Pick<
    CostableSaleLineItem,
    | 'kind'
    | 'quantity'
    | 'costMethod'
    | 'fixedCost'
    | 'hourlyCost'
    | 'recordedMinutes'
    | 'unitCostOverride'
    | 'isCostOverridden'
  >,
  serviceDoc?: Pick<
    ServiceCatalogDocument,
    'costMethod' | 'fixedCost' | 'hourlyCost' | 'defaultDurationMinutes'
  >,
): boolean => {
  if (lineItem.kind !== 'service') return false;
  if (
    lineItem.unitCostOverride !== undefined &&
    lineItem.unitCostOverride !== null &&
    Number.isFinite(Number(lineItem.unitCostOverride)) &&
    Number(lineItem.unitCostOverride) >= 0
  ) {
    return true;
  }

  const qty = Math.max(Number(lineItem.quantity) || 1, 1);
  const method: ServiceCostMethod =
    lineItem.costMethod === 'time_rate' ||
    (!lineItem.costMethod && serviceDoc?.costMethod === 'time_rate')
      ? 'time_rate'
      : 'fixed';

  if (method === 'time_rate') {
    const hourly = lineItem.isCostOverridden
      ? (lineItem.hourlyCost ?? null)
      : (lineItem.hourlyCost ?? serviceDoc?.hourlyCost ?? null);
    const minutes =
      lineItem.recordedMinutes ??
      (serviceDoc?.defaultDurationMinutes !== undefined &&
      serviceDoc?.defaultDurationMinutes !== null
        ? roundMoney(serviceDoc.defaultDurationMinutes * qty)
        : null);
    return (
      hourly !== null &&
      Number.isFinite(Number(hourly)) &&
      Number(hourly) >= 0 &&
      minutes !== null &&
      Number.isFinite(Number(minutes)) &&
      Number(minutes) >= 0
    );
  }

  const fixed = lineItem.isCostOverridden
    ? (lineItem.fixedCost ?? null)
    : (lineItem.fixedCost ?? serviceDoc?.fixedCost ?? null);
  return (
    fixed !== null &&
    Number.isFinite(Number(fixed)) &&
    Number(fixed) >= 0
  );
};

export const isServiceLineItemEligibleForCostAudit = (
  lineItem: CostableSaleLineItem,
  serviceById?: Map<string, ServiceCatalogDocument>,
): boolean => {
  if (lineItem.kind !== 'service') return false;
  if (typeof lineItem.requiresCostAudit === 'boolean') {
    return lineItem.requiresCostAudit;
  }
  if (Array.isArray(lineItem.costAuditLog) && lineItem.costAuditLog.length > 0) {
    return true;
  }
  if (
    lineItem.costSnapshot?.status === 'unknown' ||
    lineItem.auditedCost?.status === 'unknown'
  ) {
    return true;
  }
  if (
    lineItem.costSnapshot?.status === 'known' ||
    lineItem.auditedCost?.status === 'known'
  ) {
    return false;
  }
  const serviceDoc =
    lineItem.serviceId && serviceById
      ? serviceById.get(String(lineItem.serviceId))
      : undefined;
  return !hasKnownServiceCostOnAdd(lineItem, serviceDoc);
};

export const isProductLineItemEligibleForCostAudit = (
  lineItem: CostableSaleLineItem,
  productPriceById: Map<string, number | null> = new Map(),
): boolean => {
  if (lineItem.kind !== 'product') return false;
  if (typeof lineItem.requiresCostAudit === 'boolean') {
    return lineItem.requiresCostAudit;
  }
  // Legacy orders without persisted requiresCostAudit derive eligibility from saved unknown-cost markers or audit history.
  if (Array.isArray(lineItem.costAuditLog) && lineItem.costAuditLog.length > 0) {
    return true;
  }
  if (
    lineItem.costSnapshot?.status === 'unknown' ||
    lineItem.auditedCost?.status === 'unknown'
  ) {
    return true;
  }
  if (
    lineItem.costSnapshot?.status === 'known' ||
    lineItem.auditedCost?.status === 'known'
  ) {
    return false;
  }
  return !hasKnownProductPurchasePriceOnAdd(lineItem, productPriceById);
};

export const prepareLineItemsWithCostSnapshots = async ({
  kind,
  nextStatus,
  existingLineItems = [],
  incomingLineItems,
  existingFirstStockCommittedAt = null,
  employee,
  now = new Date(),
  canOverrideCosts,
}: {
  kind: string;
  nextStatus: string;
  existingLineItems?: CostableSaleLineItem[];
  incomingLineItems: CostableSaleLineItem[];
  existingFirstStockCommittedAt?: Date | null;
  employee?: Pick<EmployeeDocument, '_id' | 'name' | 'role' | 'permissions'> | null;
  now?: Date;
  canOverrideCosts?: boolean;
}): Promise<{
  lineItems: CostableSaleLineItem[];
  firstStockCommittedAt: Date | null;
  costWarnings: SaleCostWarnings;
}> => {
  const allowOverrides =
    canOverrideCosts ?? canEmployeeOverrideSaleCosts(employee, kind);
  const existingById = new Map(
    existingLineItems.map((item) => [String(item.id), item]),
  );

  const serviceIds = Array.from(
    new Set(
      incomingLineItems
        .filter((item) => item.kind === 'service' && item.serviceId)
        .map((item) => String(item.serviceId)),
    ),
  );
  const productIds = Array.from(
    new Set(
      incomingLineItems
        .filter((item) => item.kind === 'product' && item.productId)
        .map((item) => String(item.productId)),
    ),
  );

  const [services, products] = await Promise.all([
    loadCatalogServicesById(serviceIds),
    loadProductsById(productIds),
  ]);

  const serviceById = new Map(
    services.map((service) => [service._id.toString(), service]),
  );
  const productPriceById = new Map(
    products.map((product) => [
      product._id.toString(),
      typeof product.price === 'number' && Number.isFinite(product.price)
        ? product.price
        : null,
    ]),
  );

  const shouldCommit = isStockCommittedStatusForKind(kind, nextStatus);
  const firstStockCommittedAt =
    existingFirstStockCommittedAt ?? (shouldCommit ? now : null);
  const actorId = employee?._id ? employee._id.toString() : null;
  const actorName = employee?.name ?? null;

  const prepared: CostableSaleLineItem[] = incomingLineItems.map((rawItem) => {
    const item = { ...rawItem } as CostableSaleLineItem;
    const existing = existingById.get(String(item.id));
    const serviceDoc =
      item.kind === 'service' && item.serviceId
        ? serviceById.get(String(item.serviceId))
        : undefined;

    const quantity = Math.max(Number(item.quantity) || 1, 1);

    const normalizedMethod = toOptionalCostMethod(item.costMethod);
    if (
      employee &&
      !allowOverrides &&
      normalizedMethod &&
      serviceDoc &&
      normalizedMethod !==
        (serviceDoc.costMethod === 'time_rate' ? 'time_rate' : 'fixed') &&
      (!existing?.costMethod || existing.costMethod !== normalizedMethod)
    ) {
      throw new HttpError(
        403,
        'Overriding service costing method requires order/sale management and finance.view permissions.',
      );
    }
    const normalizedMinutes = toOptionalNonNegativeNumber(
      item.recordedMinutes,
      'Recorded minutes',
    );
    const normalizedDirectExpenses = allowOverrides
      ? toOptionalNonNegativeNumber(item.directExpenses, 'Direct expenses')
      : undefined;
    const normalizedUnitOverride = allowOverrides
      ? toOptionalNonNegativeNumber(item.unitCostOverride, 'Unit cost override')
      : undefined;
    const normalizedFixed = allowOverrides
      ? toOptionalNonNegativeNumber(item.fixedCost, 'Fixed cost')
      : undefined;
    const normalizedHourly = allowOverrides
      ? toOptionalNonNegativeNumber(item.hourlyCost, 'Hourly cost')
      : undefined;

    if (item.kind === 'service') {
      const catalogMethod: ServiceCostMethod =
        serviceDoc?.costMethod === 'time_rate' ? 'time_rate' : 'fixed';
      item.costMethod =
        (allowOverrides ? normalizedMethod : undefined) ??
        existing?.costMethod ??
        catalogMethod;

      if (normalizedMinutes !== undefined) {
        item.recordedMinutes = normalizedMinutes;
      } else if (existing?.recordedMinutes !== undefined) {
        item.recordedMinutes = existing.recordedMinutes;
      } else if (
        serviceDoc?.defaultDurationMinutes !== undefined &&
        serviceDoc?.defaultDurationMinutes !== null
      ) {
        item.recordedMinutes = roundMoney(
          serviceDoc.defaultDurationMinutes * quantity,
        );
      } else {
        item.recordedMinutes = null;
      }

      const existingFixed = existing?.fixedCost ?? null;
      const existingHourly = existing?.hourlyCost ?? null;
      const catalogFixed = serviceDoc?.fixedCost ?? null;
      const catalogHourly = serviceDoc?.hourlyCost ?? null;

      const fixedManuallyChanged =
        normalizedFixed !== undefined &&
        (existing
          ? Boolean(existing.isCostOverridden) ||
            numbersDiffer(normalizedFixed, existingFixed)
          : numbersDiffer(normalizedFixed, catalogFixed));
      const hourlyManuallyChanged =
        normalizedHourly !== undefined &&
        (existing
          ? Boolean(existing.isCostOverridden) ||
            numbersDiffer(normalizedHourly, existingHourly)
          : numbersDiffer(normalizedHourly, catalogHourly));
      const methodManuallyChanged =
        normalizedMethod !== undefined &&
        normalizedMethod !== null &&
        normalizedMethod !== catalogMethod &&
        (!existing || existing.costMethod !== normalizedMethod || Boolean(existing.isCostOverridden));

      item.isCostOverridden =
        Boolean(existing?.isCostOverridden) ||
        fixedManuallyChanged ||
        hourlyManuallyChanged ||
        methodManuallyChanged ||
        normalizedUnitOverride != null;

      if (normalizedFixed !== undefined && item.isCostOverridden) {
        item.fixedCost = normalizedFixed;
      } else if (existing?.isCostOverridden && existingFixed !== null) {
        item.fixedCost = existingFixed;
      } else if (!existing?.costSnapshot?.capturedAt) {
        item.fixedCost = catalogFixed;
      } else {
        item.fixedCost = existingFixed;
      }

      if (normalizedHourly !== undefined && item.isCostOverridden) {
        item.hourlyCost = normalizedHourly;
      } else if (existing?.isCostOverridden && existingHourly !== null) {
        item.hourlyCost = existingHourly;
      } else if (!existing?.costSnapshot?.capturedAt) {
        item.hourlyCost = catalogHourly;
      } else {
        item.hourlyCost = existingHourly;
      }
    } else {
      item.costMethod = null;
      item.recordedMinutes = null;
      item.fixedCost = null;
      item.hourlyCost = null;
      item.isCostOverridden = Boolean(existing?.isCostOverridden) || normalizedUnitOverride != null;
    }

    item.directExpenses =
      normalizedDirectExpenses !== undefined
        ? normalizedDirectExpenses
        : (existing?.directExpenses ?? null);

    item.unitCostOverride =
      normalizedUnitOverride !== undefined
        ? normalizedUnitOverride
        : (existing?.unitCostOverride ?? null);

    if (item.kind === 'service') {
      if (!existing) {
        item.requiresCostAudit = !hasKnownServiceCostOnAdd(item, serviceDoc);
      } else if (
        (existing.costAuditLog?.length ?? 0) > 0 ||
        existing.auditedCost?.status ||
        existing.costSnapshot?.capturedAt
      ) {
        item.requiresCostAudit = isServiceLineItemEligibleForCostAudit(
          existing,
          serviceById,
        );
      } else if (typeof existing.requiresCostAudit === 'boolean') {
        const existingResolvedMethod: ServiceCostMethod =
          existing.costMethod === 'time_rate' ||
          (!existing.costMethod && serviceDoc?.costMethod === 'time_rate')
            ? 'time_rate'
            : 'fixed';
        const serviceInputsChanged =
          String(existing.serviceId ?? '') !== String(item.serviceId ?? '') ||
          existingResolvedMethod !== item.costMethod ||
          numbersDiffer(existing.fixedCost, item.fixedCost) ||
          numbersDiffer(existing.hourlyCost, item.hourlyCost) ||
          numbersDiffer(existing.recordedMinutes, item.recordedMinutes) ||
          numbersDiffer(existing.unitCostOverride, item.unitCostOverride);
        item.requiresCostAudit = serviceInputsChanged
          ? !hasKnownServiceCostOnAdd(item, serviceDoc)
          : existing.requiresCostAudit;
      } else {
        item.requiresCostAudit = isServiceLineItemEligibleForCostAudit(
          existing,
          serviceById,
        );
      }
    } else if (!existing) {
      item.requiresCostAudit = !hasKnownProductPurchasePriceOnAdd(
        item,
        productPriceById,
      );
    } else if (
      (existing.costAuditLog?.length ?? 0) > 0 ||
      existing.auditedCost?.status ||
      existing.costSnapshot?.capturedAt
    ) {
      item.requiresCostAudit = isProductLineItemEligibleForCostAudit(
        existing,
        productPriceById,
      );
    } else if (typeof existing.requiresCostAudit === 'boolean') {
      const productLinkOrOverrideChanged =
        String(existing.productId ?? '') !== String(item.productId ?? '') ||
        numbersDiffer(existing.unitCostOverride, item.unitCostOverride);
      item.requiresCostAudit = productLinkOrOverrideChanged
        ? !hasKnownProductPurchasePriceOnAdd(item, productPriceById)
        : existing.requiresCostAudit;
    } else {
      item.requiresCostAudit = isProductLineItemEligibleForCostAudit(
        existing,
        productPriceById,
      );
    }

    // Preserve immutable costSnapshot once captured at first commit.
    if (existing?.costSnapshot?.capturedAt) {
      item.costSnapshot = existing.costSnapshot;
      item.auditedCost = existing.auditedCost ?? null;
      item.costAuditLog = existing.costAuditLog ?? [];
    } else {
      item.auditedCost = existing?.auditedCost ?? null;
      item.costAuditLog = existing?.costAuditLog ?? [];

      if (shouldCommit) {
        if (item.kind === 'service') {
          const effectiveFixed = item.isCostOverridden
            ? (item.fixedCost ?? null)
            : (serviceDoc?.fixedCost ?? item.fixedCost ?? null);
          const effectiveHourly = item.isCostOverridden
            ? (item.hourlyCost ?? null)
            : (serviceDoc?.hourlyCost ?? item.hourlyCost ?? null);

          item.costSnapshot = computeServiceSnapshotValues({
            quantity,
            costMethod: item.costMethod === 'time_rate' ? 'time_rate' : 'fixed',
            fixedCost: effectiveFixed,
            hourlyCost: effectiveHourly,
            recordedMinutes: item.recordedMinutes ?? null,
            directExpenses: item.directExpenses ?? null,
            unitCostOverride: item.unitCostOverride ?? null,
            actorId,
            actorName,
            capturedAt: now,
          });
        } else {
          const stockPrice = item.productId
            ? (productPriceById.get(String(item.productId)) ?? null)
            : null;
          item.costSnapshot = computeProductSnapshotValues({
            quantity,
            productPrice: stockPrice,
            directExpenses: item.directExpenses ?? null,
            unitCostOverride: item.unitCostOverride ?? null,
            actorId,
            actorName,
            capturedAt: now,
          });
        }
      } else {
        item.costSnapshot = null;
      }
    }

    return item;
  });

  const costWarnings = evaluateSaleCostWarnings(
    prepared,
    productPriceById,
    serviceById,
  );

  return {
    lineItems: prepared,
    firstStockCommittedAt,
    costWarnings,
  };
};

export const resolveLineItemEffectiveCost = (
  lineItem: CostableSaleLineItem,
  productPriceById: Map<string, number | null> = new Map(),
  serviceById?: Map<string, ServiceCatalogDocument>,
): {
  status: LineCostStatus;
  unitCost: number | null;
  totalCost: number | null;
  method: LineCostMethod;
  directExpenses: number | null;
  recordedMinutes: number | null;
  source: 'audited' | 'snapshot' | 'preview' | 'legacy_product' | 'legacy_unknown';
} => {
  if (lineItem.auditedCost?.status) {
    return {
      status: lineItem.auditedCost.status,
      unitCost: lineItem.auditedCost.unitCost ?? null,
      totalCost: lineItem.auditedCost.totalCost ?? null,
      method: lineItem.auditedCost.method ?? 'unknown',
      directExpenses: lineItem.auditedCost.directExpenses ?? lineItem.directExpenses ?? null,
      recordedMinutes:
        lineItem.auditedCost.recordedMinutes ?? lineItem.recordedMinutes ?? null,
      source: 'audited',
    };
  }

  if (lineItem.costSnapshot?.status) {
    return {
      status: lineItem.costSnapshot.status,
      unitCost: lineItem.costSnapshot.unitCost ?? null,
      totalCost: lineItem.costSnapshot.totalCost ?? null,
      method: lineItem.costSnapshot.method ?? 'unknown',
      directExpenses: lineItem.costSnapshot.directExpenses ?? lineItem.directExpenses ?? null,
      recordedMinutes:
        lineItem.costSnapshot.recordedMinutes ?? lineItem.recordedMinutes ?? null,
      source: 'snapshot',
    };
  }

  if (lineItem.kind === 'service') {
    const qty = Math.max(Number(lineItem.quantity) || 1, 1);
    const serviceDoc =
      serviceById && lineItem.serviceId
        ? serviceById.get(String(lineItem.serviceId))
        : undefined;
    const hasExplicitInputs =
      lineItem.unitCostOverride !== undefined ||
      lineItem.fixedCost !== undefined ||
      lineItem.hourlyCost !== undefined ||
      lineItem.costMethod !== undefined ||
      Boolean(serviceDoc);

    if (hasExplicitInputs && serviceById) {
      const preview = computeServiceSnapshotValues({
        quantity: qty,
        costMethod:
          lineItem.costMethod === 'time_rate' ||
          (!lineItem.costMethod && serviceDoc?.costMethod === 'time_rate')
            ? 'time_rate'
            : 'fixed',
        fixedCost: lineItem.fixedCost ?? serviceDoc?.fixedCost ?? null,
        hourlyCost: lineItem.hourlyCost ?? serviceDoc?.hourlyCost ?? null,
        recordedMinutes:
          lineItem.recordedMinutes ??
          (serviceDoc?.defaultDurationMinutes != null
            ? roundMoney(serviceDoc.defaultDurationMinutes * qty)
            : null),
        directExpenses: lineItem.directExpenses ?? null,
        unitCostOverride: lineItem.unitCostOverride ?? null,
        actorId: null,
        actorName: null,
        capturedAt: new Date(0),
      });
      return {
        status: preview.status,
        unitCost: preview.unitCost,
        totalCost: preview.totalCost,
        method: preview.method,
        directExpenses: preview.directExpenses,
        recordedMinutes: preview.recordedMinutes,
        source: preview.status === 'known' ? 'preview' : 'legacy_unknown',
      };
    }

    return {
      status: 'unknown',
      unitCost: null,
      totalCost: null,
      method: 'unknown',
      directExpenses: lineItem.directExpenses ?? null,
      recordedMinutes: lineItem.recordedMinutes ?? null,
      source: 'legacy_unknown',
    };
  }

  if (lineItem.unitCostOverride !== undefined && lineItem.unitCostOverride !== null) {
    const qty = Math.max(Number(lineItem.quantity) || 1, 1);
    const base = roundMoney(lineItem.unitCostOverride * qty);
    const total = roundMoney(base + (lineItem.directExpenses ?? 0));
    return {
      status: 'known',
      unitCost: roundUnitCost(total / qty),
      totalCost: total,
      method: total === 0 ? 'zero' : 'manual',
      directExpenses: lineItem.directExpenses ?? null,
      recordedMinutes: null,
      source: 'preview',
    };
  }

  if (lineItem.productId) {
    const stockPrice = productPriceById.get(String(lineItem.productId));
    if (typeof stockPrice === 'number' && Number.isFinite(stockPrice) && stockPrice >= 0) {
      const qty = Math.max(Number(lineItem.quantity) || 1, 1);
      const total = roundMoney(stockPrice * qty + (lineItem.directExpenses ?? 0));
      return {
        status: 'known',
        unitCost: roundUnitCost(total / qty),
        totalCost: total,
        method: 'stock',
        directExpenses: lineItem.directExpenses ?? null,
        recordedMinutes: null,
        source: 'legacy_product',
      };
    }
  }

  return {
    status: 'unknown',
    unitCost: null,
    totalCost: null,
    method: 'unknown',
    directExpenses: lineItem.directExpenses ?? null,
    recordedMinutes: null,
    source: 'legacy_unknown',
  };
};

export const evaluateSaleCostWarnings = (
  lineItems: CostableSaleLineItem[],
  productPriceById: Map<string, number | null> = new Map(),
  serviceById?: Map<string, ServiceCatalogDocument>,
): SaleCostWarnings => {
  const missingCostLineItemIds = lineItems
    .filter(
      (item) =>
        resolveLineItemEffectiveCost(item, productPriceById, serviceById)
          .status !== 'known',
    )
    .map((item) => String(item.id));

  return {
    hasMissingCosts: missingCostLineItemIds.length > 0,
    missingCostCount: missingCostLineItemIds.length,
    missingCostLineItemIds,
  };
};

export const buildNextStatusTransitions = ({
  existingTransitions = [],
  fromStatus,
  toStatus,
  employee,
  now = new Date(),
}: {
  existingTransitions?: StatusTransitionValue[];
  fromStatus: string | null;
  toStatus: string;
  employee?: Pick<EmployeeDocument, '_id' | 'name'> | null;
  now?: Date;
}): StatusTransitionValue[] => {
  if (fromStatus === toStatus) {
    return existingTransitions;
  }

  return [
    ...existingTransitions,
    {
      id: randomUUID(),
      fromStatus,
      toStatus,
      changedById: employee?._id ? employee._id.toString() : null,
      changedByName: employee?.name ?? null,
      changedAt: now,
    },
  ];
};

export const scaleReturnedLineItemCostSnapshots = (
  lineItem: CostableSaleLineItem,
  nextQuantity: number,
): CostableSaleLineItem => {
  const safeNextQty = Math.max(Number(nextQuantity) || 0, 0);
  if (safeNextQty <= 0) return lineItem;

  const scaleSnapshot = (
    snap: CostSnapshotValue | null | undefined,
  ): CostSnapshotValue | null | undefined => {
    if (!snap) return snap;
    if (snap.status !== 'known' || snap.unitCost === null) return snap;
    const prevQty = Math.max(Number(lineItem.quantity) || 1, 1);
    const nextTotal =
      prevQty > 0 && snap.totalCost !== null
        ? roundMoney((snap.totalCost / prevQty) * safeNextQty)
        : roundMoney(snap.unitCost * safeNextQty);
    return {
      ...snap,
      totalCost: nextTotal,
      unitCost: roundUnitCost(nextTotal / safeNextQty),
    };
  };

  return {
    ...lineItem,
    quantity: safeNextQty,
    costSnapshot: scaleSnapshot(lineItem.costSnapshot) ?? null,
    auditedCost: scaleSnapshot(lineItem.auditedCost) ?? null,
  };
};

export type AuditedLineCostUpdateInput = {
  lineItemId: string;
  status?: unknown;
  costMethod?: unknown;
  unitCost?: unknown;
  fixedCost?: unknown;
  hourlyCost?: unknown;
  recordedMinutes?: unknown;
  directExpenses?: unknown;
  reason?: unknown;
};

export const updateSaleLineCosts = async (
  saleId: string,
  payload: {
    items?: unknown;
    reason?: unknown;
  },
  employee: Pick<EmployeeDocument, '_id' | 'name' | 'role' | 'permissions'>,
) => {
  isValidObjectIdOrThrow(saleId, 'saleId');
  const existingSale = await Sale.findById(saleId).lean<SaleDocument | null>();
  if (!existingSale) {
    throw new HttpError(404, 'Sale not found.');
  }

  if (!canEmployeeOverrideSaleCosts(employee, existingSale.kind)) {
    throw new HttpError(
      403,
      'Updating order costs requires order/sale management and finance.view permissions.',
    );
  }

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (rawItems.length === 0) {
    throw new HttpError(400, 'At least one line item cost update is required.');
  }

  const existingLineItems = (existingSale.lineItems ?? []) as unknown as CostableSaleLineItem[];
  const productIds = Array.from(
    new Set(
      existingLineItems
        .filter((item) => item.kind === 'product' && item.productId)
        .map((item) => String(item.productId)),
    ),
  );
  const serviceIds = Array.from(
    new Set(
      existingLineItems
        .filter((item) => item.kind === 'service' && item.serviceId)
        .map((item) => String(item.serviceId)),
    ),
  );

  const [services, products] = await Promise.all([
    loadCatalogServicesById(serviceIds),
    loadProductsById(productIds),
  ]);
  const serviceById = new Map(
    services.map((service) => [service._id.toString(), service]),
  );
  const productPriceById = new Map(
    products.map((product) => [
      product._id.toString(),
      typeof product.price === 'number' && Number.isFinite(product.price)
        ? product.price
        : null,
    ]),
  );

  const now = new Date();
  const actorId = employee._id ? employee._id.toString() : null;
  const actorName = employee.name || 'Employee';
  const sharedReason = String(payload.reason ?? '').trim();

  const updatesById = new Map<string, AuditedLineCostUpdateInput>();
  for (const raw of rawItems) {
    const entry = (raw ?? {}) as AuditedLineCostUpdateInput;
    const lineItemId = String(entry.lineItemId ?? '').trim();
    if (!lineItemId) {
      throw new HttpError(400, 'lineItemId is required for every cost update.');
    }
    updatesById.set(lineItemId, entry);
  }

  let hasServiceUpdates = false;
  for (const lineItemId of updatesById.keys()) {
    const targetItem = existingLineItems.find(
      (item) => String(item.id) === lineItemId,
    );
    if (!targetItem) {
      throw new HttpError(404, `Line item "${lineItemId}" was not found on this order.`);
    }
    if (targetItem.kind === 'service') {
      hasServiceUpdates = true;
      continue;
    }
    if (targetItem.kind !== 'product') {
      throw new HttpError(
        400,
        'Cost audit is only allowed for eligible product or service line items.',
      );
    }
    if (!isProductLineItemEligibleForCostAudit(targetItem, productPriceById)) {
      throw new HttpError(
        400,
        `Line item "${targetItem.name}" does not require cost audit.`,
      );
    }
  }

  if (hasServiceUpdates) {
    const policy = await getFinancePolicy();
    if (!policy.serviceAuditEnabled) {
      throw new HttpError(
        400,
        'Service cost audit is currently disabled in finance policy.',
      );
    }
    for (const lineItemId of updatesById.keys()) {
      const targetItem = existingLineItems.find(
        (item) => String(item.id) === lineItemId,
      );
      if (!targetItem || targetItem.kind !== 'service') continue;
      if (!isServiceLineItemEligibleForCostAudit(targetItem, serviceById)) {
        throw new HttpError(
          400,
          `Line item "${targetItem.name}" does not require cost audit.`,
        );
      }
    }
  }

  const nextLineItems = existingLineItems.map((lineItem) => {
    const update = updatesById.get(String(lineItem.id));
    if (!update) return lineItem;

    const previous = resolveLineItemEffectiveCost(
      lineItem,
      productPriceById,
      serviceById,
    );

    const itemReason = String(update.reason ?? sharedReason ?? '').trim();
    if (previous.status === 'known' && itemReason.length < 2) {
      throw new HttpError(
        400,
        'A reason is required when correcting an already recorded cost.',
      );
    }
    const auditReason = itemReason || 'Completed missing cost';

    const quantity = Math.max(Number(lineItem.quantity) || 1, 1);
    const nextDirectExpenses =
      update.directExpenses !== undefined
        ? toOptionalNonNegativeNumber(update.directExpenses, 'Direct expenses') ?? null
        : (lineItem.directExpenses ?? null);
    const nextUnitCost =
      update.unitCost !== undefined
        ? toOptionalNonNegativeNumber(update.unitCost, 'Unit cost') ?? null
        : undefined;
    const nextFixed =
      update.fixedCost !== undefined
        ? toOptionalNonNegativeNumber(update.fixedCost, 'Fixed cost') ?? null
        : (lineItem.fixedCost ?? null);
    const nextHourly =
      update.hourlyCost !== undefined
        ? toOptionalNonNegativeNumber(update.hourlyCost, 'Hourly cost') ?? null
        : (lineItem.hourlyCost ?? null);
    const nextMinutes =
      update.recordedMinutes !== undefined
        ? toOptionalNonNegativeNumber(update.recordedMinutes, 'Recorded minutes') ?? null
        : (lineItem.recordedMinutes ?? null);

    let nextAuditedCost: CostSnapshotValue;
    let nextCostMethod: ServiceCostMethod | null = lineItem.costMethod ?? null;

    if (String(update.status ?? '').trim().toLowerCase() === 'unknown') {
      if (itemReason.length < 2) {
        throw new HttpError(
          400,
          'A reason is required when clearing a cost to unknown.',
        );
      }
      nextAuditedCost = {
        status: 'unknown',
        unitCost: null,
        totalCost: null,
        method: 'unknown',
        laborCost: null,
        directExpenses: nextDirectExpenses,
        recordedMinutes: nextMinutes,
        hourlyCost: nextHourly,
        fixedCost: nextFixed,
        capturedAt: now,
        capturedById: actorId,
        capturedByName: actorName,
      };
    } else if (lineItem.kind === 'service') {
      const requestedMethod = toOptionalCostMethod(update.costMethod);
      const resolvedMethod: ServiceCostMethod =
        requestedMethod ??
        (lineItem.costMethod === 'time_rate' ? 'time_rate' : 'fixed');
      nextCostMethod = resolvedMethod;

      const serviceDoc = lineItem.serviceId
        ? serviceById.get(String(lineItem.serviceId))
        : undefined;

      const clearOverrideForExplicitMethod =
        nextUnitCost === undefined &&
        (update.costMethod !== undefined ||
          update.fixedCost !== undefined ||
          update.hourlyCost !== undefined ||
          update.recordedMinutes !== undefined);
      const effectiveServiceUnitOverride =
        nextUnitCost !== undefined
          ? nextUnitCost
          : clearOverrideForExplicitMethod
            ? null
            : (lineItem.unitCostOverride ?? null);

      nextAuditedCost = computeServiceSnapshotValues({
        quantity,
        costMethod: resolvedMethod,
        fixedCost: nextFixed ?? serviceDoc?.fixedCost ?? null,
        hourlyCost: nextHourly ?? serviceDoc?.hourlyCost ?? null,
        recordedMinutes: nextMinutes,
        directExpenses: nextDirectExpenses,
        unitCostOverride: effectiveServiceUnitOverride,
        actorId,
        actorName,
        capturedAt: now,
      });
    } else {
      const stockPrice =
        lineItem.productId
          ? (productPriceById.get(String(lineItem.productId)) ?? null)
          : null;
      const effectiveUnitCost =
        nextUnitCost !== undefined
          ? nextUnitCost
          : (lineItem.unitCostOverride ?? null);
      nextAuditedCost = computeProductSnapshotValues({
        quantity,
        productPrice:
          effectiveUnitCost !== null ? effectiveUnitCost : stockPrice,
        directExpenses: nextDirectExpenses,
        unitCostOverride: effectiveUnitCost,
        actorId,
        actorName,
        capturedAt: now,
      });
    }

    if (
      String(update.status ?? '').trim().toLowerCase() !== 'unknown' &&
      nextAuditedCost.status !== 'known'
    ) {
      throw new HttpError(
        400,
        `Cannot save incomplete cost for "${lineItem.name}". Enter a valid cost (explicit 0 is allowed).`,
      );
    }

    const auditEntry: CostAuditEntryValue = {
      id: randomUUID(),
      previousStatus: previous.status,
      previousUnitCost: previous.unitCost,
      previousTotalCost: previous.totalCost,
      newStatus: nextAuditedCost.status,
      newUnitCost: nextAuditedCost.unitCost,
      newTotalCost: nextAuditedCost.totalCost,
      method: nextAuditedCost.method,
      directExpenses: nextAuditedCost.directExpenses,
      recordedMinutes: nextAuditedCost.recordedMinutes,
      hourlyCost: nextAuditedCost.hourlyCost,
      fixedCost: nextAuditedCost.fixedCost,
      reason: auditReason,
      authorId: actorId,
      authorName: actorName,
      changedAt: now,
    };

    return {
      ...lineItem,
      requiresCostAudit: true,
      costMethod: nextCostMethod,
      recordedMinutes: nextMinutes,
      fixedCost: nextFixed,
      hourlyCost: nextHourly,
      directExpenses: nextDirectExpenses,
      unitCostOverride:
        String(update.status ?? '').trim().toLowerCase() === 'unknown'
          ? null
          : nextUnitCost !== undefined
            ? nextUnitCost
            : lineItem.kind === 'service' &&
                (update.costMethod !== undefined ||
                  update.fixedCost !== undefined ||
                  update.hourlyCost !== undefined ||
                  update.recordedMinutes !== undefined)
              ? null
              : (lineItem.unitCostOverride ?? null),
      auditedCost: nextAuditedCost,
      costAuditLog: [...(lineItem.costAuditLog ?? []), auditEntry],
    };
  });

  const updatedSale = await Sale.findByIdAndUpdate(
    saleId,
    { lineItems: nextLineItems },
    { returnDocument: 'after', runValidators: true },
  ).lean<SaleDocument | null>();

  if (!updatedSale) {
    throw new HttpError(404, 'Sale not found.');
  }

  return formatSale(updatedSale, { includeCosts: true });
};
