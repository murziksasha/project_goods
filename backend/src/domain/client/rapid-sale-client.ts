import { Client, type ClientDocument } from './model';

export const RAPID_SALE_CLIENT_NOTE = '__rapid_sale_system__';
const RAPID_SALE_CLIENT_PHONE = '+380000000001';
const RAPID_SALE_CLIENT_NAME = 'Rapid Sale';

export const getOrCreateRapidSaleClient = async (): Promise<ClientDocument> => {
  const existing = await Client.findOne({ note: RAPID_SALE_CLIENT_NOTE }).lean<ClientDocument | null>();
  if (existing) {
    return existing;
  }

  const client = new Client({
    phone: RAPID_SALE_CLIENT_PHONE,
    phones: [RAPID_SALE_CLIENT_PHONE],
    name: RAPID_SALE_CLIENT_NAME,
    email: '',
    address: '',
    registrationId: '',
    iban: '',
    note: RAPID_SALE_CLIENT_NOTE,
    status: '',
  });
  await client.validate();
  await client.save();
  return client.toObject<ClientDocument>();
};