export type ProductPayload = {
  name?: unknown;
  article?: unknown;
  serialNumber?: unknown;
  price?: unknown;
  salePriceOptions?: unknown;
  quantity?: unknown;
  note?: unknown;
  purchasePlace?: unknown;
  warehouseId?: unknown;
  locationId?: unknown;
  purchaseDate?: unknown;
  warrantyPeriod?: unknown;
  reservedQuantity?: unknown;
  expectedUpdatedAt?: unknown;
};

export type ProductModelUpdatePayload = {
  name?: unknown;
  article?: unknown;
  note?: unknown;
  retailPrice?: unknown;
  wholesalePrice?: unknown;
  purchasePrice?: unknown;
};

export type ClientPayload = {
  phone?: unknown;
  phones?: unknown;
  name?: unknown;
  email?: unknown;
  address?: unknown;
  registrationId?: unknown;
  iban?: unknown;
  note?: unknown;
  status?: unknown;
};

export type MergeClientsPayload = {
  targetClientId?: unknown;
  sourceClientId?: unknown;
};

export type MergeSuppliersPayload = {
  targetSupplierId?: unknown;
  sourceSupplierId?: unknown;
};

export type SalePayload = {
  saleDate?: unknown;
  clientId?: unknown;
  productId?: unknown;
  quantity?: unknown;
  salePrice?: unknown;
  note?: unknown;
  managerId?: unknown;
  masterId?: unknown;
  issuedById?: unknown;
  kind?: unknown;
  status?: unknown;
  paidAmount?: unknown;
  timeline?: unknown;
  paymentHistory?: unknown;
  lineItems?: unknown;
  discount?: unknown;
  deviceName?: unknown;
  serialNumber?: unknown;
  expectedUpdatedAt?: unknown;
};

export type EmployeePayload = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
  permissions?: unknown;
  isActive?: unknown;
  note?: unknown;
};

export type SettingsPayload = {
  serviceName?: unknown;
  company?: unknown;
  companyAddress?: unknown;
  companyId?: unknown;
  companyIban?: unknown;
  companyEmail?: unknown;
  companySite?: unknown;
  printForms?: unknown;
  orderDefaults?: unknown;
  numbering?: unknown;
  financeDefaults?: unknown;
  notificationSettings?: unknown;
};

export type WarehouseSettingsPayload = {
  serviceCenters?: unknown;
  warehouses?: unknown;
  administrators?: unknown;
};

export type ServiceCatalogPayload = {
  name?: unknown;
  price?: unknown;
  salePriceOptions?: unknown;
  note?: unknown;
  isActive?: unknown;
};

export type SupplierPayload = {
  phone?: unknown;
  phones?: unknown;
  name?: unknown;
  note?: unknown;
  supplierOrder?: unknown;
  isActive?: unknown;
};

export type ClientDevicePayload = {
  clientId?: unknown;
  clientName?: unknown;
  clientPhone?: unknown;
  name?: unknown;
  serialNumber?: unknown;
  note?: unknown;
  source?: unknown;
  isActive?: unknown;
  expectedUpdatedAt?: unknown;
};
