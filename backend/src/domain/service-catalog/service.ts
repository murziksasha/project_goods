import { ServiceCatalog, type ServiceCatalogDocument } from './model';
import { Sale } from '../sale/model';
import { getSearchQuery } from '../../shared/lib/query';
import type { ServiceCatalogPayload } from '../shared/types';

const defaultServices: Array<{ name: string; price: number; note: string }> = [
  { name: 'Diagnostics', price: 400, note: 'Basic device diagnostics' },
  { name: 'Screen replacement', price: 3200, note: 'Display module replacement' },
  { name: 'Battery replacement', price: 1800, note: 'Battery and installation' },
  { name: 'Cleaning and maintenance', price: 900, note: 'Preventive cleaning service' },
  { name: 'Software setup', price: 700, note: 'OS and driver setup' },
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
    { new: true, runValidators: true },
  ).lean<ServiceCatalogDocument | null>();

  if (!updatedService) {
    throw new Error('Service not found.');
  }

  return {
    action: 'deactivated' as const,
    service: formatServiceCatalogItem(updatedService),
  };
};
