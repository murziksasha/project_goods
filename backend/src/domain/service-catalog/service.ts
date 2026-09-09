import mongoose from 'mongoose';
import { ServiceCatalog, type ServiceCatalogDocument } from './model';
import { Sale } from '../sale/model';
import { escapeRegExp, getSearchQuery } from '../../shared/lib/query';
import { toNumber } from '../../shared/lib/parsers';
import type { ServiceCatalogPayload } from '../shared/types';
import { HttpError } from '../../shared/lib/errors';

const defaultServices: Array<{ name: string; price: number; note: string }> = [
  { name: 'Діагностика', price: 250, note: 'Стандартна діагностика приладу' },
  { name: 'Доналаштування ОС', price: 1000, note: 'Роботи по ОС, встановлення драйверів тощо' },
  { name: 'Доналаштування андроїд ОС', price: 750, note: 'Доналаштування андроїд приладу' },
  { name: 'Очищення та заміна термопасти', price: 500, note: 'Стандарнте очищення та заміна термопасти у приладі' },
  { name: 'Очищення та заміна термопасти ноутбука', price: 1000, note: 'Обслуговування ноутбку, заміна термопасти' },
  { name: 'Заміна термопасти ноутбука (фазовий перехід)', price: 1000, note: 'Обслуговування ноутбку, заміна термопасти' },
];

const SEARCH_LIMIT = 20;

const normalizeName = (value: unknown) => String(value ?? '').trim();
const normalizePrice = (value: unknown) => {
  const price = toNumber(value);
  if (!Number.isFinite(price) || price < 0) {
    throw new HttpError(400, 'Service price cannot be negative.');
  }
  return price;
};
const safePrice = (value: unknown) => {
  const price = toNumber(value);
  return Number.isFinite(price) && price >= 0 ? price : 0;
};

const splitNumericList = (value: unknown) => {
  if (Array.isArray(value)) return value;
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return [];
  if (rawValue.includes(';') || rawValue.includes('\n')) {
    return rawValue.split(/[;\n]/);
  }
  return rawValue.split(/,\s+/);
};

const normalizeSalePriceOptions = (value: unknown) =>
  splitNumericList(value)
    .map((item) => normalizePrice(item))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .slice(0, 2);

const formatServiceCatalogItem = (service: ServiceCatalogDocument) => ({
  id: service._id.toString(),
  name: service.name,
  price: service.price,
  salePriceOptions: service.salePriceOptions ?? [],
  note: service.note ?? '',
  isActive: service.isActive ?? true,
  createdAt: service.createdAt.toISOString(),
  updatedAt: service.updatedAt.toISOString(),
});

const ensureDefaultServices = async () => {
  if (await ServiceCatalog.exists({})) {
    return;
  }

  await ServiceCatalog.insertMany(
    defaultServices.map((service) => ({
      ...service,
      searchText: [service.name, service.note].join(' ').toLowerCase(),
    })),
  );
};

let backfillPromise: Promise<void> | null = null;

export const resetServiceCatalogBackfillState = () => {
  backfillPromise = null;
};

export const findServiceCatalogByName = async (name: string) => {
  const normalized = normalizeName(name);
  if (normalized.length < 2) return null;

  const service = await ServiceCatalog.findOne({
    name: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' },
  }).lean<ServiceCatalogDocument | null>();

  return service ? formatServiceCatalogItem(service) : null;
};

export const upsertServiceCatalogItem = async ({
  name,
  price,
  serviceId,
}: {
  name: unknown;
  price?: unknown;
  serviceId?: unknown;
}) => {
  const normalized = normalizeName(name);
  if (normalized.length < 2) return null;

  const existingId = String(serviceId ?? '').trim();
  if (existingId && mongoose.isValidObjectId(existingId)) {
    const byId = await ServiceCatalog.findById(existingId).lean<ServiceCatalogDocument | null>();
    if (byId) return formatServiceCatalogItem(byId);
  }

  const byName = await findServiceCatalogByName(normalized);
  if (byName) return byName;

  return createServiceCatalogItem({
    name: normalized,
    price: safePrice(price),
  });
};

export const attachServiceCatalogIds = async <
  T extends {
    kind: string;
    name: string;
    price: number;
    serviceId?: string | mongoose.Types.ObjectId | null;
  },
>(
  lineItems: T[],
): Promise<T[]> => {
  const resolved: T[] = [];

  for (const item of lineItems) {
    if (item.kind !== 'service') {
      resolved.push(item);
      continue;
    }

    const upserted = await upsertServiceCatalogItem({
      name: item.name,
      price: item.price,
      serviceId: item.serviceId,
    });
    if (!upserted) {
      resolved.push(item);
      continue;
    }

    resolved.push({ ...item, serviceId: upserted.id });
  }

  return resolved;
};

export const backfillMissingServicesFromSales = async () => {
  const rows = await Sale.aggregate<{ name: string; price: number }>([
    { $unwind: '$lineItems' },
    { $match: { 'lineItems.kind': 'service' } },
    {
      $group: {
        _id: {
          $toLower: {
            $trim: { input: { $ifNull: ['$lineItems.name', ''] } },
          },
        },
        name: { $first: '$lineItems.name' },
        price: { $first: '$lineItems.price' },
      },
    },
  ]);

  for (const row of rows) {
    await upsertServiceCatalogItem({ name: row.name, price: row.price });
  }
};

const ensureServicesFromSales = async () => {
  if (!backfillPromise) {
    backfillPromise = backfillMissingServicesFromSales().catch((error) => {
      backfillPromise = null;
      console.error('Failed to backfill service catalog from sales', error);
    });
  }

  await backfillPromise;
};

export const listServiceCatalogItems = async (queryValue: unknown) => {
  await ensureDefaultServices();
  await ensureServicesFromSales();

  const query = typeof queryValue === 'string' ? queryValue.trim() : '';
  const finder = ServiceCatalog.find(getSearchQuery(queryValue)).sort({
    createdAt: -1,
  });
  if (query) {
    finder.limit(SEARCH_LIMIT);
  }

  const services = await finder.lean<ServiceCatalogDocument[]>();
  const formatted = services.map(formatServiceCatalogItem);

  if (query) {
    const exact = await findServiceCatalogByName(query);
    if (exact && !formatted.some((item) => item.id === exact.id)) {
      return [exact, ...formatted].slice(0, SEARCH_LIMIT);
    }
  }

  return formatted;
};

export const createServiceCatalogItem = async (
  payload: ServiceCatalogPayload,
) => {
  const service = new ServiceCatalog({
    name: normalizeName(payload.name),
    price: normalizePrice(payload.price),
    salePriceOptions: normalizeSalePriceOptions(payload.salePriceOptions),
    note: String(payload.note ?? '').trim(),
  });

  await service.validate();
  await service.save();

  return formatServiceCatalogItem(
    service.toObject<ServiceCatalogDocument>(),
  );
};

export const updateServiceCatalogItem = async (
  serviceId: string,
  payload: ServiceCatalogPayload,
) => {
  const service = await ServiceCatalog.findById(serviceId);
  if (!service) {
    throw new HttpError(404, 'Service not found.');
  }

  service.name = normalizeName(payload.name);
  service.price = normalizePrice(payload.price);
  service.salePriceOptions = normalizeSalePriceOptions(payload.salePriceOptions);
  service.note = String(payload.note ?? '').trim();
  if (payload.isActive !== undefined) {
    service.isActive =
      payload.isActive === true ||
      String(payload.isActive).toLowerCase() === 'true';
  }

  await service.validate();
  await service.save();

  return formatServiceCatalogItem(
    service.toObject<ServiceCatalogDocument>(),
  );
};

export const deleteServiceCatalogItem = async (serviceId: string) => {
  const service = await ServiceCatalog.findByIdAndDelete(serviceId).lean<ServiceCatalogDocument | null>();
  if (!service) {
    throw new HttpError(404, 'Service not found.');
  }

  return { id: serviceId };
};

export const archiveServiceCatalogItem = async (serviceId: string) => {
  const service = await ServiceCatalog.findById(serviceId).lean<ServiceCatalogDocument | null>();
  if (!service) {
    throw new HttpError(404, 'Service not found.');
  }

  const wasUsed = await Sale.exists({
    lineItems: {
      $elemMatch: {
        kind: 'service',
        name: service.name,
      },
    },
  });

  if (!wasUsed) {
    await ServiceCatalog.findByIdAndDelete(serviceId);
    return { id: serviceId, action: 'deleted' as const };
  }

  const updatedService = await ServiceCatalog.findByIdAndUpdate(
    serviceId,
    { isActive: false },
    { returnDocument: 'after', runValidators: true },
  ).lean<ServiceCatalogDocument | null>();

  if (!updatedService) {
    throw new HttpError(404, 'Service not found.');
  }

  return {
    action: 'deactivated' as const,
    service: formatServiceCatalogItem(updatedService),
  };
};
