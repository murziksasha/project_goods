import { ServiceCatalog, type ServiceCatalogDocument } from './model';
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

const formatServiceCatalogItem = (service: ServiceCatalogDocument) => ({
  id: service._id.toString(),
  name: service.name,
  price: service.price,
  note: service.note ?? '',
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
    note: String(payload.note ?? '').trim(),
  });

  await service.validate();
  await service.save();

  return formatServiceCatalogItem(
    service.toObject<ServiceCatalogDocument>(),
  );
};
