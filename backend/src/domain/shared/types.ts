export type ProductPayload = {
  name?: unknown;
  article?: unknown;
  serialNumber?: unknown;
  price?: unknown;
  salePriceOptions?: unknown;
  quantity?: unknown;
  note?: unknown;
  purchasePlace?: unknown;
  purchaseDate?: unknown;
  warrantyPeriod?: unknown;
  reservedQuantity?: unknown;
};

export type ClientPayload = {
  phone?: unknown;
  name?: unknown;
  note?: unknown;
  status?: unknown;
};

export type SalePayload = {
  saleDate?: unknown;
  clientId?: unknown;
  productId?: unknown;
  quantity?: unknown;
  salePrice?: unknown;
  note?: unknown;
};
