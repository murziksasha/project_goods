import type { Client, ClientFormValues } from './types';

export const initialClientForm: ClientFormValues = {
  phone: '',
  phones: [''],
  name: '',
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: 'new',
};

export const getClientPhones = (client: Client): string[] => {
  if (Array.isArray(client.phones) && client.phones.length > 0) {
    return client.phones.filter((p): p is string => Boolean(p));
  }
  return client.phone ? [client.phone] : [];
};

export const getPrimaryClientPhone = (client: Client): string => {
  const phones = getClientPhones(client);
  return phones[0] || client.phone || '';
};

export const toClientForm = (client: Client): ClientFormValues => {
  const phoneList = getClientPhones(client);
  const primary = phoneList[0] || client.phone || '';
  return {
    phone: primary,
    phones: phoneList.length > 0 ? [...phoneList] : (primary ? [primary] : ['']),
    name: client.name,
    email: client.email,
    address: client.address,
    registrationId: client.registrationId,
    iban: client.iban,
    note: client.note,
    status: client.status,
  };
};
