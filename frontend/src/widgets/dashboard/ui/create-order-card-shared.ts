import type { ClientHistory } from '../../../entities/client/model/types';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import {
  getSaleProductName,
  getSaleProductSerialNumber,
} from '../../../entities/sale/lib/sale-product';
import type { CreateOrderRequestPayload } from '../model/order-request';
import { createRuntimeId } from '../../../shared/lib/runtime-id';
import { parseDecimal } from '../../../shared/lib/decimal';

export type SaleOrderItem = {
  id: string;
  query: string;
  source: '' | 'stock' | 'catalog';
  productId: string;
  catalogProductId: string;
  article: string;
  serialNumber: string;
  price: string;
  unitPrice: string;
  quantity: string;
  warrantyPeriod: string;
};

export type ClientRequestTab = 'orders' | 'sales';

export const topTabs: Array<{
  key: CreateOrderRequestPayload['sourceTab'];
  labelKey: string;
}> = [
  { key: 'repair', labelKey: 'orders.tabs.repairOrder' },
  { key: 'sale', labelKey: 'orders.tabs.salesOrder' },
];

export type CreateOrderExtraOption = {
  key: string;
  labelKey: string;
};

export const extraOptionsLeft: CreateOrderExtraOption[] = [
  { key: 'deviceStaysWithClient', labelKey: 'orders.create.extraOptions.repair.deviceStaysWithClient' },
  { key: 'urgentRepair', labelKey: 'orders.create.extraOptions.repair.urgentRepair' },
  { key: 'acceptedByPost', labelKey: 'orders.create.extraOptions.repair.acceptedByPost' },
  {
    key: 'startWorkWithoutConfirmation',
    labelKey: 'orders.create.extraOptions.repair.startWorkWithoutConfirmation',
  },
  { key: 'clientCanWaitForParts', labelKey: 'orders.create.extraOptions.repair.clientCanWaitForParts' },
];

export const extraOptionsRight: CreateOrderExtraOption[] = [
  { key: 'courierTookDevice', labelKey: 'orders.create.extraOptions.repair.courierTookDevice' },
  {
    key: 'replacementDeviceIssued',
    labelKey: 'orders.create.extraOptions.repair.replacementDeviceIssued',
  },
  { key: 'homeMasterCall', labelKey: 'orders.create.extraOptions.repair.homeMasterCall' },
];

export const saleExtraOptionsLeft: CreateOrderExtraOption[] = [
  { key: 'newSale', labelKey: 'orders.create.extraOptions.sale.newSale' },
  { key: 'issued', labelKey: 'orders.create.extraOptions.sale.issued' },
  { key: 'atPostalCompany', labelKey: 'orders.create.extraOptions.sale.atPostalCompany' },
  { key: 'waitingForSupply', labelKey: 'orders.create.extraOptions.sale.waitingForSupply' },
];

export const saleExtraOptionsRight: CreateOrderExtraOption[] = [
  { key: 'reservedForClient', labelKey: 'orders.create.extraOptions.sale.reservedForClient' },
  { key: 'needsInvoice', labelKey: 'orders.create.extraOptions.sale.needsInvoice' },
  { key: 'warrantyCardIssued', labelKey: 'orders.create.extraOptions.sale.warrantyCardIssued' },
  { key: 'deliveryRequired', labelKey: 'orders.create.extraOptions.sale.deliveryRequired' },
];

export const createOrderTabStorageKey = 'project-goods.create-order-tab';
export const createOrderClientRequestsTabStorageKey =
  'project-goods.create-order-client-requests-tab';

export const createSaleOrderItem = (): SaleOrderItem => ({
  id: createRuntimeId(),
  query: '',
  source: '',
  productId: '',
  catalogProductId: '',
  article: '',
  serialNumber: '',
  price: '',
  unitPrice: '',
  quantity: '1',
  warrantyPeriod: '0',
});

export const formatPhone = (input: string) => {
  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const normalizedDigits = digitsOnly.startsWith('380')
    ? digitsOnly.slice(3)
    : digitsOnly.startsWith('0')
      ? digitsOnly.slice(1)
      : digitsOnly;
  const localDigits = normalizedDigits.slice(0, 9);

  let result = '+380';
  if (localDigits.length > 0) result += ` ${localDigits.slice(0, 2)}`;
  if (localDigits.length > 2) result += ` ${localDigits.slice(2, 5)}`;
  if (localDigits.length > 5) result += ` ${localDigits.slice(5, 7)}`;
  if (localDigits.length > 7) result += ` ${localDigits.slice(7, 9)}`;
  return result;
};

export const phoneDigitsOnly = (value: string) => value.replace(/\D/g, '');

export const toNameKey = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

export const toDeviceLookupKey = (value: string) =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

export const parseDecimalInput = (value: string) => {
  const numeric = parseDecimal(value || '0');
  return Number.isFinite(numeric) ? numeric : 0;
};

export const toApiPhone = (input: string) => {
  const digits = phoneDigitsOnly(input);
  if (digits.startsWith('380') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) {
    return `+380${digits.slice(1)}`;
  }
  if (digits.length === 9) return `+380${digits}`;
  return '';
};

export const extractDeviceKit = (note: string) =>
  note
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');

export const filterActiveDevicesByQuery = (
  devices: ClientDevice[],
  rawQuery: string,
) => {
  const normalizedQuery = toDeviceLookupKey(rawQuery);
  const activeDevices = devices.filter((device) => device.isActive);
  if (!normalizedQuery) return activeDevices;

  return activeDevices.filter((device) => {
    const lookupFields = [
      device.name,
      device.serialNumber,
      device.clientName,
      device.clientPhone,
      device.note,
    ];
    return lookupFields.some((field) =>
      toDeviceLookupKey(field || '').includes(normalizedQuery),
    );
  });
};

export const getDeviceHistory = (history: ClientHistory | null) => {
  if (!history) return [];

  const seen = new Set<string>();
  return history.sales.filter((sale) => {
    if (sale.kind !== 'repair') return false;
    const deviceItem = sale.lineItems?.find((item) => item.kind === 'product');
    const deviceName = (
      deviceItem?.name?.trim() ||
      getSaleProductName(sale) ||
      ''
    ).toLowerCase();
    const serial = getSaleProductSerialNumber(sale).toLowerCase();
    const dedupeKey = `${deviceName}::${serial}`;
    if (seen.has(dedupeKey)) {
      return false;
    }
    seen.add(dedupeKey);
    return true;
  });
};

export { getOrderLink } from '../../../pages/dashboard/model/dashboard-navigation';
