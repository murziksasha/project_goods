import type { ClientStatus } from './types';

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
