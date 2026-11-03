import type { Client, Sale } from '../model/types';

export const patchSaleClientSnapshot = (sale: Sale, client: Client): Sale => {
  if (sale.client?.id !== client.id) return sale;

  return {
    ...sale,
    client: {
      ...sale.client,
      name: client.name,
      phone: client.phone,
      phones: client.phones,
      status: client.status,
      email: client.email,
      address: client.address,
      registrationId: client.registrationId,
      iban: client.iban,
    },
  };
};

export const mapCachedSalesClientSnapshot = (
  current: unknown,
  client: Client,
): unknown => {
  if (Array.isArray(current)) {
    return current.map((item) =>
      item && typeof item === 'object'
        ? patchSaleClientSnapshot(item as Sale, client)
        : item,
    );
  }

  if (
    current &&
    typeof current === 'object' &&
    Array.isArray((current as { items?: unknown }).items)
  ) {
    const page = current as { items: Sale[] };
    return {
      ...page,
      items: page.items.map((item) => patchSaleClientSnapshot(item, client)),
    };
  }

  if (current && typeof current === 'object' && 'client' in current) {
    return patchSaleClientSnapshot(current as Sale, client);
  }

  return current;
};
