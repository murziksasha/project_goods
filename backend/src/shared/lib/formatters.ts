import type { ClientDocument } from '../../domain/client/model';
import type { EmployeeDocument } from '../../domain/employee/model';
import type { ProductDocument } from '../../domain/product/model';
import type { SaleDocument } from '../../domain/sale/model';
import type { SupplierDocument } from '../../domain/supplier/model';
import type { ClientDeviceDocument } from '../../domain/client-device/model';
import type { CatalogProductDocument } from '../../domain/catalog-product/model';
import {
  getEffectiveEmployeePermissions,
  ordersTabPreferenceKeys,
  type OrdersTabPreferenceKey,
} from '../../domain/employee/constants';
import { getSaleDocumentTotal } from './saleTotals';

export const formatProduct = (product: ProductDocument) => {
  const freeQuantity = Math.max(
    product.quantity - product.reservedQuantity,
    0,
  );

  return {
    id: product._id.toString(),
    name: product.name,
    article: product.article,
    serialNumber: product.serialNumber ?? '',
    price: product.price,
    salePriceOptions: product.salePriceOptions ?? [],
    note: product.note ?? '',
    quantity: product.quantity,
    reservedQuantity: product.reservedQuantity,
    freeQuantity,
    isInStock: freeQuantity > 0,
    purchasePlace: product.purchasePlace,
    warehouseId: product.warehouseId ?? '',
    locationId: product.locationId ?? '',
    supplierOrderId: product.supplierOrderId ?? '',
    supplierOrderItemIndex:
      typeof product.supplierOrderItemIndex === 'number'
        ? product.supplierOrderItemIndex
        : undefined,
    purchaseDate: product.purchaseDate
      ? product.purchaseDate.toISOString()
      : null,
    warrantyPeriod: product.warrantyPeriod,
    isActive: product.isActive ?? true,
    sortOrder: product.sortOrder ?? 0,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
};

export const formatClient = (client: ClientDocument) => ({
  id: client._id.toString(),
  phone: client.phone,
  phones:
    Array.isArray(client.phones) && client.phones.length > 0
      ? client.phones
      : client.phone
        ? [client.phone]
        : [],
  name: client.name,
  email: client.email ?? '',
  address: client.address ?? '',
  registrationId: client.registrationId ?? '',
  iban: client.iban ?? '',
  note: client.note,
  status: client.status,
  createdAt: client.createdAt.toISOString(),
  updatedAt: client.updatedAt.toISOString(),
});

export const formatSupplier = (supplier: SupplierDocument) => ({
  id: supplier._id.toString(),
  phone: supplier.phone,
  phones:
    Array.isArray(supplier.phones) && supplier.phones.length > 0
      ? supplier.phones
      : supplier.phone
        ? [supplier.phone]
        : [],
  name: supplier.name,
  note: supplier.note,
  supplierOrder: supplier.supplierOrder ?? '',
  isActive: supplier.isActive,
  sortOrder: supplier.sortOrder ?? 0,
  createdAt: supplier.createdAt.toISOString(),
  updatedAt: supplier.updatedAt.toISOString(),
});

export const formatCatalogProduct = (
  item: CatalogProductDocument,
  usageCount = 0,
) => ({
  id: item._id.toString(),
  name: item.name,
  note: item.note ?? '',
  isActive: item.isActive ?? true,
  usageCount,
  canRemove: usageCount === 0,
  sourceTags: item.sourceTags ?? [],
  sortOrder: item.sortOrder ?? 0,
  lastSeenAt: item.lastSeenAt
    ? item.lastSeenAt.toISOString()
    : item.updatedAt.toISOString(),
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export const formatClientDevice = (
  device: ClientDeviceDocument,
  usageCount = 0,
) => ({
  id: device._id.toString(),
  clientId: device.client ? device.client.toString() : '',
  clientName: device.clientName,
  clientPhone: device.clientPhone,
  name: device.name,
  serialNumber: device.serialNumber ?? '',
  note: device.note ?? '',
  source: device.source,
  isActive: device.isActive ?? true,
  usageCount,
  canRemove: usageCount === 0,
  createdAt: device.createdAt.toISOString(),
  updatedAt: device.updatedAt.toISOString(),
});

const formatHiddenOrdersTabs = (employee: EmployeeDocument) => {
  const hidden = employee.uiPreferences?.hiddenOrdersTabs;
  if (!Array.isArray(hidden)) {
    return [] as OrdersTabPreferenceKey[];
  }

  return hidden.filter((tab): tab is OrdersTabPreferenceKey =>
    ordersTabPreferenceKeys.includes(tab as OrdersTabPreferenceKey),
  );
};

export const formatEmployee = (employee: EmployeeDocument) => ({
  id: employee._id.toString(),
  name: employee.name,
  phone: employee.phone,
  email: employee.email ?? '',
  username: employee.username ?? '',
  role: employee.role,
  permissions: getEffectiveEmployeePermissions(employee),
  allowedCashboxIds: Array.isArray(employee.allowedCashboxIds)
    ? employee.allowedCashboxIds
    : [],
  isActive: employee.isActive,
  isRegistered: Boolean(employee.username),
  note: employee.note,
  uiPreferences: {
    hiddenOrdersTabs: formatHiddenOrdersTabs(employee),
  },
  createdAt: employee.createdAt.toISOString(),
  updatedAt: employee.updatedAt.toISOString(),
});

const formatSnapshotBlock = (
  snap: Record<string, unknown> | null | undefined,
) => {
  if (!snap || typeof snap !== 'object') return null;
  const capturedAt = snap.capturedAt instanceof Date
    ? snap.capturedAt.toISOString()
    : snap.capturedAt
      ? String(snap.capturedAt)
      : null;
  return {
    status: snap.status === 'known' ? 'known' : 'unknown',
    unitCost:
      typeof snap.unitCost === 'number' && Number.isFinite(snap.unitCost)
        ? snap.unitCost
        : null,
    totalCost:
      typeof snap.totalCost === 'number' && Number.isFinite(snap.totalCost)
        ? snap.totalCost
        : null,
    method: String(snap.method ?? 'unknown'),
    laborCost:
      typeof snap.laborCost === 'number' && Number.isFinite(snap.laborCost)
        ? snap.laborCost
        : null,
    directExpenses:
      typeof snap.directExpenses === 'number' &&
      Number.isFinite(snap.directExpenses)
        ? snap.directExpenses
        : null,
    recordedMinutes:
      typeof snap.recordedMinutes === 'number' &&
      Number.isFinite(snap.recordedMinutes)
        ? snap.recordedMinutes
        : null,
    hourlyCost:
      typeof snap.hourlyCost === 'number' && Number.isFinite(snap.hourlyCost)
        ? snap.hourlyCost
        : null,
    fixedCost:
      typeof snap.fixedCost === 'number' && Number.isFinite(snap.fixedCost)
        ? snap.fixedCost
        : null,
    capturedAt,
    capturedById: snap.capturedById ? String(snap.capturedById) : null,
    capturedByName: snap.capturedByName ? String(snap.capturedByName) : null,
  };
};

export const formatSale = (
  sale: SaleDocument,
  optionsOrIndex: number | { includeCosts?: boolean } = {},
  _array?: SaleDocument[],
) => {
  const options =
    typeof optionsOrIndex === 'object' && optionsOrIndex !== null
      ? optionsOrIndex
      : {};
  const includeCosts = options.includeCosts !== false;
  const formattedLineItems = (sale.lineItems ?? []).map((item) => {
    const rawItem = item as unknown as Record<string, unknown>;
    const costSnapshot = formatSnapshotBlock(
      rawItem.costSnapshot as Record<string, unknown> | null | undefined,
    );
    const auditedCost = formatSnapshotBlock(
      rawItem.auditedCost as Record<string, unknown> | null | undefined,
    );
    const effectiveStatus = auditedCost?.status ?? costSnapshot?.status ?? null;
    const rawPreviewKnown =
      rawItem.unitCostOverride !== undefined && rawItem.unitCostOverride !== null
        ? true
        : item.kind === 'service'
          ? rawItem.costMethod === 'time_rate'
            ? rawItem.hourlyCost !== undefined &&
              rawItem.hourlyCost !== null &&
              rawItem.recordedMinutes !== undefined &&
              rawItem.recordedMinutes !== null
            : rawItem.fixedCost !== undefined && rawItem.fixedCost !== null
          : Boolean(item.productId);
    const costKnown =
      effectiveStatus !== null
        ? effectiveStatus === 'known'
        : rawPreviewKnown
          ? true
          : false;
    const costAuditLog = Array.isArray(rawItem.costAuditLog)
      ? rawItem.costAuditLog.map((entry) => {
          const e = entry as Record<string, unknown>;
          return {
            id: String(e.id ?? ''),
            previousStatus: e.previousStatus === 'known' ? 'known' : 'unknown',
            previousUnitCost:
              typeof e.previousUnitCost === 'number' ? e.previousUnitCost : null,
            previousTotalCost:
              typeof e.previousTotalCost === 'number' ? e.previousTotalCost : null,
            newStatus: e.newStatus === 'known' ? 'known' : 'unknown',
            newUnitCost: typeof e.newUnitCost === 'number' ? e.newUnitCost : null,
            newTotalCost:
              typeof e.newTotalCost === 'number' ? e.newTotalCost : null,
            method: String(e.method ?? 'unknown'),
            directExpenses:
              typeof e.directExpenses === 'number' ? e.directExpenses : null,
            recordedMinutes:
              typeof e.recordedMinutes === 'number' ? e.recordedMinutes : null,
            hourlyCost: typeof e.hourlyCost === 'number' ? e.hourlyCost : null,
            fixedCost: typeof e.fixedCost === 'number' ? e.fixedCost : null,
            reason: String(e.reason ?? ''),
            authorId: e.authorId ? String(e.authorId) : null,
            authorName: String(e.authorName ?? ''),
            changedAt:
              e.changedAt instanceof Date
                ? e.changedAt.toISOString()
                : String(e.changedAt ?? ''),
          };
        })
      : [];
    const requiresCostAudit =
      typeof rawItem.requiresCostAudit === 'boolean'
        ? rawItem.requiresCostAudit
        : costAuditLog.length > 0 ||
          costSnapshot?.status === 'unknown' ||
          auditedCost?.status === 'unknown' ||
          (!costSnapshot?.status && !auditedCost?.status && !rawPreviewKnown);

    const baseLine: Record<string, unknown> = {
      id: item.id,
      kind: item.kind,
      productId: item.productId ? item.productId.toString() : undefined,
      catalogProductId: item.catalogProductId
        ? item.catalogProductId.toString()
        : undefined,
      serviceId: item.serviceId ? item.serviceId.toString() : undefined,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      warrantyPeriod: item.warrantyPeriod ?? 0,
      serialNumbers: (item.serialNumbers ?? []).map((serial) =>
        String(serial),
      ),
      costMethod:
        rawItem.costMethod === 'time_rate'
          ? 'time_rate'
          : rawItem.costMethod === 'fixed'
            ? 'fixed'
            : null,
      recordedMinutes:
        typeof rawItem.recordedMinutes === 'number'
          ? rawItem.recordedMinutes
          : null,
      costKnown,
    };

    if (includeCosts) {
      baseLine.fixedCost =
        typeof rawItem.fixedCost === 'number' ? rawItem.fixedCost : null;
      baseLine.hourlyCost =
        typeof rawItem.hourlyCost === 'number' ? rawItem.hourlyCost : null;
      baseLine.directExpenses =
        typeof rawItem.directExpenses === 'number'
          ? rawItem.directExpenses
          : null;
      baseLine.unitCostOverride =
        typeof rawItem.unitCostOverride === 'number'
          ? rawItem.unitCostOverride
          : null;
      baseLine.requiresCostAudit = requiresCostAudit;
      baseLine.costSnapshot = costSnapshot;
      baseLine.auditedCost = auditedCost;
      baseLine.costAuditLog = costAuditLog;
    }

    return baseLine;
  });

  const missingCostLineItemIds = formattedLineItems
    .filter((item) => item.costKnown === false)
    .map((item) => String(item.id));

  const saleAny = sale as unknown as Record<string, unknown>;
  const statusTransitions = Array.isArray(saleAny.statusTransitions)
    ? saleAny.statusTransitions.map((entry) => {
        const t = entry as Record<string, unknown>;
        return {
          id: String(t.id ?? ''),
          fromStatus: t.fromStatus ? String(t.fromStatus) : null,
          toStatus: String(t.toStatus ?? ''),
          changedById: t.changedById ? String(t.changedById) : null,
          changedByName: t.changedByName ? String(t.changedByName) : null,
          changedAt:
            t.changedAt instanceof Date
              ? t.changedAt.toISOString()
              : String(t.changedAt ?? ''),
        };
      })
    : [];

  const returnEvents = Array.isArray(saleAny.returnEvents)
    ? saleAny.returnEvents.map((entry) => {
        const r = entry as Record<string, unknown>;
        return {
          id: String(r.id ?? ''),
          lineItemId: r.lineItemId ? String(r.lineItemId) : null,
          name: String(r.name ?? ''),
          productId: r.productId ? String(r.productId) : null,
          catalogProductId: r.catalogProductId ? String(r.catalogProductId) : null,
          quantity: Number(r.quantity ?? 0),
          grossAmount: Number(r.grossAmount ?? 0),
          refundAmount: Number(r.refundAmount ?? 0),
          unitCost:
            includeCosts && typeof r.unitCost === 'number' ? r.unitCost : null,
          returnedAt:
            r.returnedAt instanceof Date
              ? r.returnedAt.toISOString()
              : String(r.returnedAt ?? ''),
          returnedById: r.returnedById ? String(r.returnedById) : null,
          returnedByName: r.returnedByName ? String(r.returnedByName) : null,
        };
      })
    : [];

  return {
    id: sale._id.toString(),
    recordNumber: sale.recordNumber ?? null,
    saleDate: sale.saleDate.toISOString(),
    quantity: sale.quantity,
    salePrice: sale.salePrice,
    kind: sale.kind,
    status: sale.status,
    paidAmount: sale.paidAmount ?? 0,
    isFavorite: sale.isFavorite ?? false,
    isRapidSale: sale.isRapidSale ?? false,
    note: sale.note,
    userNote: sale.userNote ?? '',
    timeline: (sale.timeline ?? []).map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      author: entry.author,
      message: entry.message,
      createdAt: entry.createdAt.toISOString(),
    })),
    paymentHistory: (sale.paymentHistory ?? []).map((entry) => ({
      id: entry.id,
      type: entry.type,
      paymentMethod:
        entry.paymentMethod === 'non-cash' ? 'non-cash' : 'cash',
      amount: entry.amount,
      cashboxId: entry.cashboxId,
      cashboxName: entry.cashboxName,
      author: entry.author,
      createdAt: entry.createdAt.toISOString(),
    })),
    lineItems: formattedLineItems,
    firstStockCommittedAt:
      saleAny.firstStockCommittedAt instanceof Date
        ? saleAny.firstStockCommittedAt.toISOString()
        : saleAny.firstStockCommittedAt
          ? String(saleAny.firstStockCommittedAt)
          : null,
    completedAt:
      saleAny.completedAt instanceof Date
        ? saleAny.completedAt.toISOString()
        : saleAny.completedAt
          ? String(saleAny.completedAt)
          : null,
    statusTransitions,
    returnEvents,
    costWarnings: {
      hasMissingCosts: missingCostLineItemIds.length > 0,
      missingCostCount: missingCostLineItemIds.length,
      missingCostLineItemIds,
    },
    discount: {
      mode: sale.discount?.mode === 'amount' ? 'amount' : 'percent',
      value: sale.discount?.value ?? 0,
    },
    client: {
      id: sale.client.toString(),
      ...sale.clientSnapshot,
    },
    product: {
      id: sale.product ? sale.product.toString() : '',
      ...sale.productSnapshot,
      serialNumber: sale.productSnapshot?.serialNumber ?? '',
    },
    manager: sale.manager
      ? {
          id: sale.manager.toString(),
          ...(sale.managerSnapshot ?? { name: '', role: '' }),
        }
      : null,
    master: sale.master
      ? {
          id: sale.master.toString(),
          ...(sale.masterSnapshot ?? { name: '', role: '' }),
        }
      : null,
    issuedBy: sale.issuedBy
      ? {
          id: sale.issuedBy.toString(),
          ...(sale.issuedBySnapshot ?? { name: '', role: '' }),
        }
      : null,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    kanbanRank: sale.kanbanRank ?? undefined,
  };
};

export const formatClientHistory = (
  client: ClientDocument,
  sales: SaleDocument[],
) => ({
  client: formatClient(client),
  sales: sales.map(formatSale),
  stats: {
    totalSales: sales.length,
    totalRevenue: sales.reduce(
      (sum, sale) => sum + getSaleDocumentTotal(sale),
      0,
    ),
    totalItemsSold: sales.reduce(
      (sum, sale) => sum + sale.quantity,
      0,
    ),
  },
});
