import type { Client, ClientStatus } from '../model/types';

export const filterClientsByStatus = (
  clients: Client[],
  status: ClientStatus | 'all',
) => (status === 'all' ? clients : clients.filter((client) => client.status === status));

export const filterClientsByQuery = (clients: Client[], query: string) => {
  if (!query) {
    return clients;
  }

  const normalizedDigits = query.replace(/\D/g, '');
  const normalizedQuery = query.toLowerCase();

  return clients.filter((client) => {
    const clientDigits = client.phone.replace(/\D/g, '');

    return (
      client.name.toLowerCase().includes(normalizedQuery) ||
      client.phone.toLowerCase().includes(normalizedQuery) ||
      (normalizedDigits.length > 0 && clientDigits.includes(normalizedDigits))
    );
  });
};
