export const clientStatuses = ['new', 'vip', 'opt', 'blacklist', 'ok'] as const;

export type ClientStatus = (typeof clientStatuses)[number];
