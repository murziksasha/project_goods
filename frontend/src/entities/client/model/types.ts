import type { Sale } from '../../sale/model/types';

export type ClientStatus = 'new' | 'vip' | 'opt' | 'blacklist' | 'ok';

export type Client = {
  id: string;
  phone: string;
  phones: string[];
  name: string;
  email: string;
  address: string;
  registrationId: string;
  iban: string;
  note: string;
  status: ClientStatus | '';
  createdAt: string;
  updatedAt: string;
};

export type ClientFormValues = {
  phone: string;
  phones: string[];
  name: string;
  email: string;
  address: string;
  registrationId: string;
  iban: string;
  note: string;
  status: ClientStatus | '';
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

export type ClientImportReportEntry = {
  rowNumber: number;
  reason: string;
  name?: string;
  phone?: string;
  details?: string;
};

export type ClientImportReport = {
  sheetName: string;
  totalRows: number;
  prepared: number;
  created: number;
  skippedMissingRequired: number;
  skippedExisting: number;
  validationFailed: number;
  skipped: ClientImportReportEntry[];
  validationErrors: ClientImportReportEntry[];
  clients: Client[];
};
