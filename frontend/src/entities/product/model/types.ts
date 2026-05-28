export type Product = {
  id: string;
  name: string;
  article: string;
  serialNumber: string;
  price: number;
  salePriceOptions: number[];
  note: string;
  quantity: number;
  reservedQuantity: number;
  freeQuantity: number;
  isInStock: boolean;
  purchasePlace: string;
  warehouseId?: string;
  locationId?: string;
  purchaseDate: string | null;
  warrantyPeriod: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductFormValues = {
  name: string;
  article: string;
  serialNumber: string;
  price: string;
  salePriceOptions: string;
  quantity: string;
  note: string;
  purchasePlace: string;
  warehouseId?: string;
  locationId?: string;
  purchaseDate: string;
  warrantyPeriod: string;
  isActive?: boolean;
  expectedUpdatedAt?: string;
};

export type ProductModelUpdatePayload = {
  name: string;
  article?: string;
  note?: string;
  retailPrice?: string | number;
  wholesalePrice?: string | number;
  purchasePrice?: string | number;
};
