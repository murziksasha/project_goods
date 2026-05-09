import { ServiceCatalog, type ServiceCatalogDocument } from './model';
import { Sale } from '../sale/model';
import { getSearchQuery } from '../../shared/lib/query';
import type { ServiceCatalogPayload } from '../shared/types';

const defaultServices: Array<{ name: string; price: number; note: string }> = [
  { name: 'Діагностика', price: 250, note: 'Стандартна діагностика приладу' },
  { name: 'Доналаштування ОС', price: 1000, note: 'Роботи по ОС, встановлення драйверів тощо' },
  { name: 'Доналаштування андроїд ОС', price: 750, note: 'Доналаштування андроїд приладу' },
  { name: 'Очищення та заміна термопасти', price: 500, note: 'Стандарнте очищення та заміна термопасти у приладі' },
  { name: 'Очищення та заміна термопасти ноутбука', price: 1000, note: 'Обслуговування ноутбку, заміна термопасти' },
    { name: 'Заміна термопасти ноутбука (фазовий перехід)', price: 1000, note: 'Обслуговування ноутбку, заміна термопасти' },
];

const normalizeName = (value: unknown) => String(value ?? '').trim();
const normalizePrice = (value: unknown) => {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Service price cannot be negative.');
  }
  return price;
};
const normalizeSalePriceOptions = (value: unknown) =>
  (Array.isArray(value) ? value : String(value ?? '').split(','))
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

export const listServiceCatalogItems = async (queryValue: unknown) => {
  await ensureDefaultServices();

  const services = await ServiceCatalog.find(getSearchQuery(queryValue))
    .sort({ createdAt: -1 })
    .limit(20)
    .lean<ServiceCatalogDocument[]>();

  return services.map(formatServiceCatalogItem);
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
    throw new Error('Service not found.');
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
    throw new Error('Service not found.');
  }

  return { id: serviceId };
};

export const archiveServiceCatalogItem = async (serviceId: string) => {
  const service = await ServiceCatalog.findById(serviceId).lean<ServiceCatalogDocument | null>();
  if (!service) {
    throw new Error('Service not found.');
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
    throw new Error('Service not found.');
  }

  return {
    action: 'deactivated' as const,
    service: formatServiceCatalogItem(updatedService),
  };
};
