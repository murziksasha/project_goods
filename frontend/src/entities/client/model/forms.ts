import type { Client, ClientFormValues } from './types';

export const initialClientForm: ClientFormValues = {
  phone: '',
  name: '',
  note: '',
  status: 'new',
};

export const toClientForm = (client: Client): ClientFormValues => ({
  phone: client.phone,
  name: client.name,
  note: client.note,
  status: client.status,
});
