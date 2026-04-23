import { clientStatuses, type ClientStatus } from '../../domain/client/constants';
import {
  employeePermissions,
  employeeRoles,
  type EmployeePermission,
  type EmployeeRole,
} from '../../domain/employee/constants';
import type {
  ClientPayload,
  EmployeePayload,
  ProductPayload,
  SalePayload,
  SettingsPayload,
} from '../../domain/shared/types';

export const toNonEmptyString = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

export const toOptionalDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value);
  }

  return NaN;
};

export const normalizePhone = (value: unknown) =>
  String(value ?? '')
    .replace(/[^\d+]/g, '')
    .trim();

export const normalizeProductPayload = (payload: ProductPayload) => ({
  name: toNonEmptyString(payload.name),
  article: toNonEmptyString(payload.article).toUpperCase(),
  serialNumber: toNonEmptyString(payload.serialNumber).toUpperCase(),
  price: toNumber(payload.price),
  salePriceOptions: Array.isArray(payload.salePriceOptions)
    ? payload.salePriceOptions
        .map((value) => toNumber(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
    : String(payload.salePriceOptions ?? '')
        .split(',')
        .map((value) => toNumber(value.trim()))
        .filter((value) => Number.isFinite(value) && value >= 0),
  quantity: toNumber(payload.quantity),
  note: toNonEmptyString(payload.note),
  reservedQuantity:
    payload.reservedQuantity === '' || payload.reservedQuantity === undefined
      ? 0
      : toNumber(payload.reservedQuantity),
  purchasePlace: toNonEmptyString(payload.purchasePlace),
  purchaseDate: toOptionalDate(payload.purchaseDate),
  warrantyPeriod:
    payload.warrantyPeriod === '' || payload.warrantyPeriod === undefined
      ? 0
      : toNumber(payload.warrantyPeriod),
});

export const normalizeClientPayload = (payload: ClientPayload) => ({
  phone: normalizePhone(payload.phone),
  name: toNonEmptyString(payload.name),
  note: toNonEmptyString(payload.note),
  status: clientStatuses.includes(String(payload.status ?? '') as ClientStatus)
    ? (payload.status as ClientStatus)
    : 'new',
});

export const normalizeSalePayload = (payload: SalePayload) => ({
  saleDate: toOptionalDate(payload.saleDate) ?? new Date(),
  clientId: toNonEmptyString(payload.clientId),
  productId: toNonEmptyString(payload.productId),
  quantity: toNumber(payload.quantity),
  salePrice: toNumber(payload.salePrice),
  note: toNonEmptyString(payload.note),
  managerId: toNonEmptyString(payload.managerId),
  masterId: toNonEmptyString(payload.masterId),
  kind: toNonEmptyString(payload.kind) === 'sale' ? 'sale' : 'repair',
  status: toNonEmptyString(payload.status) || 'new',
  paidAmount:
    payload.paidAmount === undefined ? 0 : toNumber(payload.paidAmount),
  timeline: Array.isArray(payload.timeline)
    ? payload.timeline
        .map((entry) => ({
          id: toNonEmptyString((entry as { id?: unknown })?.id),
          author: toNonEmptyString((entry as { author?: unknown })?.author),
          message: toNonEmptyString((entry as { message?: unknown })?.message),
          createdAt:
            toOptionalDate((entry as { createdAt?: unknown })?.createdAt) ?? new Date(),
        }))
        .filter((entry) => entry.id && entry.author && entry.message)
    : [],
  paymentHistory: Array.isArray(payload.paymentHistory)
    ? payload.paymentHistory
        .map((entry) => ({
          id: toNonEmptyString((entry as { id?: unknown })?.id),
          type: toNonEmptyString((entry as { type?: unknown })?.type),
          amount: toNumber((entry as { amount?: unknown })?.amount),
          cashboxId: toNonEmptyString((entry as { cashboxId?: unknown })?.cashboxId),
          cashboxName: toNonEmptyString((entry as { cashboxName?: unknown })?.cashboxName),
          author: toNonEmptyString((entry as { author?: unknown })?.author),
          createdAt:
            toOptionalDate((entry as { createdAt?: unknown })?.createdAt) ?? new Date(),
        }))
        .filter(
          (entry) =>
            entry.id &&
            (entry.type === 'deposit' || entry.type === 'refund') &&
            Number.isFinite(entry.amount) &&
            entry.amount >= 0 &&
            entry.cashboxId &&
            entry.cashboxName &&
            entry.author,
        )
    : [],
  lineItems: Array.isArray(payload.lineItems)
    ? payload.lineItems
        .map((item) => ({
          id: toNonEmptyString((item as { id?: unknown })?.id),
          kind: toNonEmptyString((item as { kind?: unknown })?.kind),
          name: toNonEmptyString((item as { name?: unknown })?.name),
          price: toNumber((item as { price?: unknown })?.price),
          quantity: toNumber((item as { quantity?: unknown })?.quantity),
        }))
        .filter(
          (item) =>
            item.id &&
            (item.kind === 'product' || item.kind === 'service') &&
            item.name &&
            Number.isFinite(item.price) &&
            item.price >= 0 &&
            Number.isFinite(item.quantity) &&
            item.quantity > 0,
        )
    : [],
});

export const normalizeEmployeePayload = (payload: EmployeePayload) => {
  const roleRaw = String(payload.role ?? '');
  const role = employeeRoles.includes(roleRaw as EmployeeRole)
    ? (roleRaw as EmployeeRole)
    : 'manager';
  const parsedPermissions = Array.isArray(payload.permissions)
    ? payload.permissions
        .map((value) => String(value))
        .filter((value): value is EmployeePermission =>
          employeePermissions.includes(value as EmployeePermission),
        )
    : String(payload.permissions ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is EmployeePermission =>
          employeePermissions.includes(value as EmployeePermission),
        );

  const defaultRolePermissions: Record<EmployeeRole, EmployeePermission[]> = {
    owner: [...employeePermissions],
    manager: ['orders.view', 'orders.manage', 'clients.manage'],
    master: ['orders.view', 'repairs.execute'],
    accountant: ['orders.view', 'sales.manage'],
    warehouse: ['orders.view', 'inventory.manage'],
    sales: ['orders.view', 'sales.manage', 'clients.manage'],
    support: ['orders.view'],
  };

  return {
    name: toNonEmptyString(payload.name),
    phone: normalizePhone(payload.phone),
    username: toNonEmptyString(payload.username).toLowerCase(),
    password: toNonEmptyString(payload.password),
    role,
    permissions:
      parsedPermissions.length > 0
        ? Array.from(new Set(parsedPermissions))
        : defaultRolePermissions[role],
    isActive:
      payload.isActive === undefined
        ? true
        : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
    note: toNonEmptyString(payload.note),
  };
};

export const normalizeSettingsPayload = (payload: SettingsPayload) => ({
  serviceName: toNonEmptyString(payload.serviceName) || 'Service CRM',
});
