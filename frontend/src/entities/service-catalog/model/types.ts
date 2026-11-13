import type { ServiceCostMethod } from '../../../shared/types/domain';

export type ServiceCatalogItem = {
  id: string;
  name: string;
  price: number;
  salePriceOptions: number[];
  note: string;
  costMethod?: ServiceCostMethod;
  fixedCost?: number | null;
  hourlyCost?: number | null;
  defaultDurationMinutes?: number | null;
  isActive: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
};

export type ServiceCatalogFormValues = {
  name: string;
  price: string;
  salePriceOptions: string;
  note: string;
  costMethod?: ServiceCostMethod;
  fixedCost?: string;
  hourlyCost?: string;
  defaultDurationMinutes?: string;
  isActive?: boolean;
};
