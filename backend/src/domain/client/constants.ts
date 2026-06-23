export const clientStatuses = ['new', 'vip', 'opt', 'blacklist', 'ok'] as const;

export type ClientStatus = (typeof clientStatuses)[number];

export const isAutoManagedClientStatus = (status: ClientStatus | '') =>
  status === '' || status === 'new';

export const getEffectiveClientStatus = (
  status: ClientStatus | '',
  visits: number,
): ClientStatus => {
  if (status === 'blacklist') return 'blacklist';
  if (!isAutoManagedClientStatus(status)) return status as ClientStatus;
  if (visits >= 10) return 'vip';
  if (visits >= 5) return 'opt';
  if (visits >= 3) return 'ok';
  return 'new';
};