import type { ClientStatus } from './types';

export type ClientStatusOption = {
  labelKey: string;
  value: ClientStatus;
};

export const clientStatusOptions: ClientStatusOption[] = [
  { labelKey: 'clients.statusValues.new', value: 'new' },
  { labelKey: 'clients.statusValues.blacklist', value: 'blacklist' },
  { labelKey: 'clients.statusValues.vip', value: 'vip' },
  { labelKey: 'clients.statusValues.opt', value: 'opt' },
  { labelKey: 'clients.statusValues.ok', value: 'ok' },
];

export const clientStatuses: ClientStatus[] = [
  'new',
  'vip',
  'opt',
  'blacklist',
  'ok',
];

export const clientStatusFilters: Array<ClientStatus | 'all'> = [
  'all',
  ...clientStatuses,
];

export const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  new: '#6B7280', // gray - для новых клиентов
  vip: '#F59E0B', // amber - для VIP клиентов
  opt: '#10B981', // emerald - для клиентов с оптовыми скидками
  blacklist: '#EF4444', // red - для черного списка
  ok: '#3B82F6', // blue - для обычных/регулярных клиентов
};

export const getClientStatusColor = (status: ClientStatus | ''): string => {
  if (!status) return '#6B7280'; // gray для пустого статуса
  return CLIENT_STATUS_COLORS[status];
};

export const getClientStatusClass = (status: ClientStatus | ''): string => {
  if (!status) return 'status-gray';
  return `status-${status}`;
};

export const isAutoManagedClientStatus = (status: ClientStatus | '') =>
  status === '' || status === 'new';

export const getClientStatusLabelKey = (status: ClientStatus | ''): string =>
  status ? `clients.statusValues.${status}` : 'clients.statusValues.empty';

/**
 * Effective client status for UI and filters:
 * - blacklist always wins
 * - ok / opt / vip are manual overrides
 * - empty or legacy "new" auto-derive from visit count
 */
export const getEffectiveClientStatusLogic = (
  status: ClientStatus | '',
  visits: number,
): ClientStatus | '' => {
  if (status === 'blacklist') return 'blacklist';
  if (!isAutoManagedClientStatus(status)) return status;
  if (visits >= 10) return 'vip';
  if (visits >= 5) return 'opt';
  if (visits >= 3) return 'ok';
  return 'new';
};

export const getClientEffectiveStatus = (
  status: ClientStatus | '',
  visits: number,
): ClientStatus | '' => getEffectiveClientStatusLogic(status, visits);
