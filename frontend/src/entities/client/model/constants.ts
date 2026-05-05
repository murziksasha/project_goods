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

/**
 * Логика определения эффективного статуса клиента:
 * - blacklist всегда имеет приоритет (не может быть изменен автоматически)
 * - если статус установлен вручную (не пустой) - используется как есть
 * - если статус пустой - автоматически определяется по количеству заказов
 */
export const getEffectiveClientStatusLogic = (
  status: ClientStatus | '',
  visits: number,
): ClientStatus | '' => {
  // blacklist всегда имеет приоритет
  if (status === 'blacklist') return 'blacklist';
  // если статус установлен вручную (не пустой), используем его
  if (status !== '') return status;
  // иначе автоматически определяем статус по количеству заказов
  if (visits >= 10) return 'vip';
  if (visits >= 5) return 'opt';
  if (visits >= 3) return 'ok';
  return 'new';
};
