import type { Client, ClientStatus } from '../model/types';
import { clientMatchesPhoneQuery } from './phone-match';

export const filterClientsByStatus = (
  clients: Client[],
  status: ClientStatus | 'all',
) => (status === 'all' ? clients : clients.filter((client) => client.status === status));

export const filterClientsByQuery = (clients: Client[], query: string) => {
  if (!query) {
    return clients;
  }

  return clients.filter((client) => clientMatchesPhoneQuery(client, query));
};
