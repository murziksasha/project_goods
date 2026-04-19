import type { ClientStatus } from '../../domain/client/constants';

export const demoClients = [
  {
    key: 'regular',
    phone: '+380671112233',
    name: 'Ivan Petrenko',
    note: 'Regular buyer, often picks peripherals.',
    status: 'ok' as ClientStatus,
  },
  {
    key: 'wholesale',
    phone: '+380931234567',
    name: 'Olena Kovalenko',
    note: 'Wholesale orders for office equipment.',
    status: 'opt' as ClientStatus,
  },
  {
    key: 'vip',
    phone: '+380501010101',
    name: 'Maxim Bondar',
    note: 'VIP customer, fast response requested.',
    status: 'vip' as ClientStatus,
  },
  {
    key: 'design',
    phone: '+380661234890',
    name: 'Svitlana Marchenko',
    note: 'Buys accessories for the design team.',
    status: 'ok' as ClientStatus,
  },
  {
    key: 'newcomer',
    phone: '+380971234321',
    name: 'Taras Melnyk',
    note: 'Often compares several monitors before purchase.',
    status: 'new' as ClientStatus,
  },
  {
    key: 'coworking',
    phone: '+380631117700',
    name: 'Andriy Shevchuk',
    note: 'Wholesale client for coworking space upgrades.',
    status: 'opt' as ClientStatus,
  },
] as const;
