export type Supplier = {
  id: string;
  phone: string;
  name: string;
  note: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierFormValues = {
  phone: string;
  name: string;
  note: string;
  isActive?: boolean;
};
