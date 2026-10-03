export type ServiceCatalogItem = {
  id: string;
  name: string;
  price: number;
  salePriceOptions: number[];
  note: string;
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
  isActive?: boolean;
};
