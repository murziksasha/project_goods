import type { ClientStatus } from './types';

export const clientStatuses: ClientStatus[] = [
  'new',
  'ok',
  'vip',
  'opt',
  'blacklist',
];

export const clientStatusFilters: Array<ClientStatus | 'all'> = [
  'all',
  ...clientStatuses,
];
