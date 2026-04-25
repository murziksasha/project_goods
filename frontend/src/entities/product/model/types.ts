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
  purchaseDate: string;
  warrantyPeriod: string;
};
