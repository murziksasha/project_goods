export type Product = {
  id: string;
  name: string;
  article: string;
  price: number;
  quantity: number;
  reservedQuantity: number;
  freeQuantity: number;
  isInStock: boolean;
  purchasePlace: string;
  purchaseDate: string | null;
  warrantyPeriod: number;
  createdAt: string;
  updatedAt: string;
};

export type EntityId = string;

export type ProductFormValues = {
  name: string;
  article: string;
  price: string;
  quantity: string;
  purchasePlace: string;
  purchaseDate: string;
  warrantyPeriod: string;
};

export type ClientStatus = 'new' | 'vip' | 'opt' | 'blacklist' | 'ok';

export type Client = {
  id: string;
  phone: string;
  name: string;
  note: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
};

export type ClientFormValues = {
  phone: string;
  name: string;
  note: string;
  status: ClientStatus;
};

export type Sale = {
  id: string;
  saleDate: string;
  quantity: number;
  salePrice: number;
  note: string;
  client: {
    id: string;
    name: string;
    phone: string;
    status: string;
  };
  product: {
    id: string;
    article: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type SaleFormValues = {
  saleDate: string;
  clientId: string;
  productId: string;
  quantity: string;
  salePrice: string;
  note: string;
};

export type SeedResponse = {
  message: string;
  products: Product[];
  clients: Client[];
  sales: Sale[];
};

export type ClientHistory = {
  client: Client;
  sales: Sale[];
  stats: {
    totalSales: number;
    totalRevenue: number;
    totalItemsSold: number;
  };
};
