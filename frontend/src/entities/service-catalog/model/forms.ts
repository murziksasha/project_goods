import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from './types';

export const initialServiceCatalogForm: ServiceCatalogFormValues = {
  name: '',
  price: '',
  salePriceOptions: '',
  note: '',
  costMethod: 'fixed',
  fixedCost: '',
  hourlyCost: '',
  defaultDurationMinutes: '',
};

export const toServiceCatalogForm = (
  service: ServiceCatalogItem,
): ServiceCatalogFormValues => ({
  name: service.name,
  price: String(service.price),
  salePriceOptions: (service.salePriceOptions ?? []).join(', '),
  note: service.note,
  costMethod: service.costMethod === 'time_rate' ? 'time_rate' : 'fixed',
  fixedCost:
    service.fixedCost !== undefined && service.fixedCost !== null
      ? String(service.fixedCost)
      : '',
  hourlyCost:
    service.hourlyCost !== undefined && service.hourlyCost !== null
      ? String(service.hourlyCost)
      : '',
  defaultDurationMinutes:
    service.defaultDurationMinutes !== undefined &&
    service.defaultDurationMinutes !== null
      ? String(service.defaultDurationMinutes)
      : '',
});
