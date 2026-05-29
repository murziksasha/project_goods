import { describe, expect, it } from 'vitest';
import {
  normalizeEmployeePayload,
  normalizeProductPayload,
  normalizeSettingsPayload,
} from './parsers';

describe('normalizeProductPayload', () => {
  it('normalizes scalar fields and filters invalid sale prices', () => {
    const result = normalizeProductPayload({
      name: '  Mouse  ',
      article: ' ab-1 ',
      serialNumber: ' sn-99 ',
      price: '2500',
      salePriceOptions: '1200, -1, foo, 1500',
      quantity: '3',
      note: '  note ',
      reservedQuantity: '',
      purchasePlace: ' store ',
      purchaseDate: '2026-01-01',
      warrantyPeriod: undefined,
    });

    expect(result).toMatchObject({
      name: 'Mouse',
      article: 'AB-1',
      serialNumber: 'SN-99',
      price: 2500,
      salePriceOptions: [1200, 1500],
      quantity: 3,
      note: 'note',
      reservedQuantity: 0,
      purchasePlace: 'store',
      warrantyPeriod: 0,
    });
    expect(result.purchaseDate).toBeInstanceOf(Date);
  });
});

describe('normalizeEmployeePayload', () => {
  it('falls back to role defaults and normalizes auth/contact fields', () => {
    const result = normalizeEmployeePayload({
      name: '  Jane ',
      phone: ' +38 (050) 123-45-67 ',
      email: ' ADMIN@MAIL.COM ',
      username: ' BOSS ',
      password: ' pass ',
      role: 'manager',
      permissions: [],
      isActive: 'true',
      note: ' hi ',
    });

    expect(result).toMatchObject({
      name: 'Jane',
      phone: '+380501234567',
      email: 'admin@mail.com',
      username: 'boss',
      password: 'pass',
      role: 'manager',
      permissions: [
        'orders.view',
        'orders.manage',
        'clients.manage',
        'finance.cashboxes.view',
        'finance.transactions.deposit',
      ],
      isActive: true,
      note: 'hi',
    });
  });

  it('accepts finance permissions and applies accountant defaults', () => {
    const parsed = normalizeEmployeePayload({
      name: 'Accountant',
      username: 'acc',
      password: 'pass',
      role: 'accountant',
      permissions: [
        'finance.view',
        'finance.transactions.withdraw',
        'invalid.permission',
      ],
    });

    expect(parsed.permissions).toEqual([
      'finance.view',
      'finance.transactions.withdraw',
    ]);

    const defaults = normalizeEmployeePayload({
      name: 'Default Accountant',
      username: 'default-acc',
      password: 'pass',
      role: 'accountant',
      permissions: [],
    });

    expect(defaults.permissions).toEqual(
      expect.arrayContaining([
        'finance.view',
        'finance.cashboxes.manage',
        'finance.transactions.deposit',
        'finance.transactions.withdraw',
        'finance.transactions.transfer',
        'finance.supplierOrders.pay',
        'finance.supplierOrders.issueWithoutPayment',
      ]),
    );
    expect(defaults.permissions).not.toContain('employees.manage');
  });
});

describe('normalizeSettingsPayload', () => {
  it('normalizes print forms and nested settings', () => {
    const result = normalizeSettingsPayload({
      serviceName: '  Repair CRM  ',
      printForms: [
        {
          id: ' receipt ',
          title: ' Receipt ',
          type: ' receipt ',
          content: ' Order {{orderNumber}} ',
          isActive: 'false',
          sortOrder: '5',
        },
        { title: '', content: 'ignored' },
      ],
      orderDefaults: {
        defaultRepairTermDays: '3',
        defaultWarrantyMonths: '6',
        defaultRepairStatus: ' diagnostics ',
        defaultSaleStatus: ' paid ',
      },
      numbering: {
        repairPrefix: ' R ',
        salePrefix: ' S ',
        supplierOrderPrefix: ' SO ',
        nextRepairNumber: '10',
        nextSaleNumber: '20',
        nextSupplierOrderNumber: '30',
      },
      financeDefaults: {
        currency: ' usd ',
        paymentMethod: 'non-cash',
      },
      notificationSettings: {
        smsEnabled: 'true',
        messengerEnabled: true,
        emailEnabled: 'false',
      },
    });

    expect(result).toMatchObject({
      serviceName: 'Repair CRM',
      printForms: [
        {
          id: 'receipt',
          title: 'Receipt',
          type: 'receipt',
          content: 'Order {{orderNumber}}',
          isActive: false,
          sortOrder: 5,
        },
      ],
      orderDefaults: {
        defaultRepairTermDays: 3,
        defaultWarrantyMonths: 6,
        defaultRepairStatus: 'diagnostics',
        defaultSaleStatus: 'paid',
      },
      numbering: {
        repairPrefix: 'R',
        salePrefix: 'S',
        supplierOrderPrefix: 'SO',
        nextRepairNumber: 10,
        nextSaleNumber: 20,
        nextSupplierOrderNumber: 30,
      },
      financeDefaults: {
        currency: 'USD',
        paymentMethod: 'non-cash',
      },
      notificationSettings: {
        smsEnabled: true,
        messengerEnabled: true,
        emailEnabled: false,
      },
    });
  });

  it('falls back to safe defaults for invalid settings values', () => {
    const result = normalizeSettingsPayload({
      serviceName: '',
      printForms: 'bad',
      orderDefaults: {
        defaultRepairTermDays: '-4',
        defaultWarrantyMonths: 'abc',
      },
      numbering: {
        nextRepairNumber: '0',
      },
      financeDefaults: {
        currency: '',
        paymentMethod: 'card',
      },
    });

    expect(result.serviceName).toBe('Service CRM');
    expect(result.printForms).toEqual([]);
    expect(result.orderDefaults.defaultRepairTermDays).toBe(0);
    expect(result.orderDefaults.defaultWarrantyMonths).toBe(1);
    expect(result.numbering.nextRepairNumber).toBe(1);
    expect(result.financeDefaults).toEqual({
      currency: 'UAH',
      paymentMethod: 'cash',
    });
  });
});
