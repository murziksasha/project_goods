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
