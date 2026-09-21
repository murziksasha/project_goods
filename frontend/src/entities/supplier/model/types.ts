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

export type SupplierImportReportEntry = {
  rowNumber: number;
  reason: string;
  name?: string;
  phone?: string;
  details?: string;
};

export type SupplierImportReport = {
  sheetName: string;
  totalRows: number;
  prepared: number;
  created: number;
  skippedMissingRequired: number;
  skippedExisting: number;
  validationFailed: number;
  skipped: SupplierImportReportEntry[];
  validationErrors: SupplierImportReportEntry[];
  suppliers: Supplier[];
};