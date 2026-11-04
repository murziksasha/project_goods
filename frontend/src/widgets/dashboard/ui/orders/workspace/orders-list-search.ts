import type { TFunction } from 'i18next';
import { getSaleClientPhones } from '../../../../../entities/client';
import type { Sale } from '../../../../../entities/sale';
import {
  getSaleClientSearchValues,
  getSaleListSearchValues,
} from '../../../../../entities/sale';
import {
  isPhoneLikeQuery,
  phonesMatchQuery,
} from '../../../../../shared/lib/phone-search';
import {
  buildOrderNumber,
  getPrimaryDeviceName,
  isRepairOrdersTab,
  type OrdersTab,
} from './orders-workspace-shared';

const pushText = (values: string[], value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (trimmed) values.push(trimmed);
};

const repairTextValues = (sale: Sale) => {
  const values: string[] = [];
  pushText(values, getPrimaryDeviceName(sale));
  pushText(values, sale.product?.name);
  pushText(values, sale.product?.serialNumber);
  pushText(values, sale.product?.article);
  for (const item of sale.lineItems ?? []) {
    pushText(values, item.name);
    for (const serial of item.serialNumbers ?? []) pushText(values, serial);
  }
  return values;
};

const listTextValues = (sale: Sale, tab: OrdersTab, t: TFunction) => {
  const values = [
    ...getSaleClientSearchValues(sale, t),
    sale.note ?? '',
    sale.userNote ?? '',
  ];

  if (isRepairOrdersTab(tab)) {
    values.push(...repairTextValues(sale));
  } else {
    values.push(
      ...getSaleListSearchValues(sale),
      sale.manager?.name ?? '',
      sale.issuedBy?.name ?? '',
    );
  }

  return values;
};

const textIncludes = (values: string[], needle: string) =>
  values.some((value) => value.toLowerCase().includes(needle));

/** Toolbar `q` match. Empty query matches every row. */
export const saleMatchesListQuery = (
  sale: Sale,
  query: string,
  tab: OrdersTab,
  t: TFunction,
) => {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const needle = trimmed.toLowerCase();
  if (String(buildOrderNumber(sale)).toLowerCase().includes(needle)) {
    return true;
  }

  const phones = getSaleClientPhones(sale);
  if (phonesMatchQuery(phones, trimmed)) return true;

  const values = listTextValues(sale, tab, t);
  if (!isPhoneLikeQuery(trimmed)) {
    values.push(...phones);
  }

  return textIncludes(values, needle);
};

/** Client filter. Matches name, record number, and phones. */
export const saleMatchesClientFilter = (
  sale: Sale,
  query: string,
  t: TFunction,
) => {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const needle = trimmed.toLowerCase();
  if (String(buildOrderNumber(sale)).toLowerCase().includes(needle)) {
    return true;
  }

  if (textIncludes(getSaleClientSearchValues(sale, t), needle)) {
    return true;
  }

  const phones = getSaleClientPhones(sale);
  if (phonesMatchQuery(phones, trimmed)) return true;
  if (isPhoneLikeQuery(trimmed)) return false;
  return phones.some((phone) => phone.toLowerCase().includes(needle));
};
