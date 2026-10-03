import type {
  Client,
  ClientStatus,
  Sale,
} from '../../../shared/types/domain';

export type { Client, ClientStatus, Sale };

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
  /** Optimistic concurrency token from last load. */
  expectedUpdatedAt?: string;
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

export type ClientStats = {
  visits: number;
  income: number;
  serviceCount: number;
  salesCount: number;
  orderNumbers: string[];
};

export const defaultClientStats: ClientStats = {
  visits: 0,
  income: 0,
  serviceCount: 0,
  salesCount: 0,
  orderNumbers: [],
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
