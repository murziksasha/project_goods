import type { Sale } from '../../sale/model/types';

export type ClientStatus = 'new' | 'vip' | 'opt' | 'blacklist' | 'ok';

export type Client = {
  id: string;
  phone: string;
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
