import type { Client, ClientFormValues } from './types';

export const initialClientForm: ClientFormValues = {
  phone: '',
  name: '',
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: 'new',
};

export const toClientForm = (client: Client): ClientFormValues => ({
  phone: client.phone,
  name: client.name,
  email: client.email,
  address: client.address,
  registrationId: client.registrationId,
  iban: client.iban,
  note: client.note,
  status: client.status,
});
