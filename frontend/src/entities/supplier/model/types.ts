export type Supplier = {
  id: string;
  phone: string;
  phones: string[];
  name: string;
  note: string;
  supplierOrder: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierFormValues = {
  phone: string;
  phones?: string[];
  name: string;
  note: string;
  supplierOrder?: string;
  isActive?: boolean;
};