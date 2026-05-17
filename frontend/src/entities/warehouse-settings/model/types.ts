export type WarehouseServiceCenter = {
  id: string;
  name: string;
  color: string;
  address: string;
  phone: string;
};

export type WarehouseLocation = {
  id: string;
  name: string;
};

export type WarehouseItem = {
  id: string;
  name: string;
  isActive: boolean;
  serviceCenterId: string;
  receiptAddress: string;
  receiptPhone: string;
  locations: WarehouseLocation[];
};

export type WarehouseAdministrator = {
  employeeId: string;
  warehouseIds: string[];
  defaultWarehouseId: string;
  defaultLocationId: string;
};

export type WarehouseSettings = {
  id: string;
  serviceCenters: WarehouseServiceCenter[];
  warehouses: WarehouseItem[];
  administrators: WarehouseAdministrator[];
  createdAt: string;
  updatedAt: string;
};

export type WarehouseSettingsPayload = {
  serviceCenters: WarehouseServiceCenter[];
  warehouses: WarehouseItem[];
  administrators: WarehouseAdministrator[];
};
