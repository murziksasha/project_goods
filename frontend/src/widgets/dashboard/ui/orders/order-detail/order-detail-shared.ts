import type { Sale } from '../../../../../entities/sale/model/types';
import i18n from '../../../../../shared/i18n/config';
import {
  getStatusLabel,
  type OrderStatus,
} from '../workspace/orders-workspace-shared';

export const buildCreatedOrderTimelineMessage = (
  sale: Sale,
  status: OrderStatus,
) =>
  i18n.t('orders.timeline.createdOrder', {
    status: getStatusLabel(sale, status),
  });