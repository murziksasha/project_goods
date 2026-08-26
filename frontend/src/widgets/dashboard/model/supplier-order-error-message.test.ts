import { describe, expect, it, vi } from 'vitest';
import { resolveSupplierOrderErrorMessage } from './supplier-order-utils';

describe('resolveSupplierOrderErrorMessage', () => {
  const t = vi.fn((key: string) => `translated:${key}`);

  it('maps known backend Ukrainian messages to i18n keys', () => {
    expect(
      resolveSupplierOrderErrorMessage(
        new Error('Оплачений заказ не можна редагувати.'),
        t,
      ),
    ).toBe('translated:orders.supplier.messages.errors.paidNotEditable');
  });

  it('maps supplier pay backend messages to i18n keys', () => {
    expect(
      resolveSupplierOrderErrorMessage(
        new Error('Замовлення вже сплачено.'),
        t,
      ),
    ).toBe('translated:orders.supplier.messages.errors.alreadyPaid');
    expect(
      resolveSupplierOrderErrorMessage(
        new Error('Cashbox balance is not enough for this operation.'),
        t,
      ),
    ).toBe(
      'translated:orders.supplier.messages.errors.cashboxBalanceNotEnough',
    );
  });

  it('falls back to provided key for unknown errors', () => {
    expect(
      resolveSupplierOrderErrorMessage(new Error(''), t, 'orders.supplier.messages.errors.failedUpdateStatus'),
    ).toBe('translated:orders.supplier.messages.errors.failedUpdateStatus');
  });
});