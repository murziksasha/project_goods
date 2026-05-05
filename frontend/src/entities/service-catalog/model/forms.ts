import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from './types';

export const initialServiceCatalogForm: ServiceCatalogFormValues = {
  name: '',
  price: '',
  salePriceOptions: '',
  note: '',
};

export const toServiceCatalogForm = (
  service: ServiceCatalogItem,
): ServiceCatalogFormValues => ({
  name: service.name,
  price: String(service.price),
  salePriceOptions: (service.salePriceOptions ?? []).join(', '),
  note: service.note,
});
