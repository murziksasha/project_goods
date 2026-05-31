import { describe, expect, it } from 'vitest';
import {
  normalizeEmployeePayload,
  normalizeProductPayload,
  normalizeSalePayload,
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

describe('normalizeSalePayload', () => {
  it('normalizes empty line item ids away and preserves catalog product ids', () => {
    const result = normalizeSalePayload({
      clientId: '507f1f77bcf86cd799439011',
      productId: '',
      quantity: '1',
      salePrice: '400',
      lineItems: [
        {
          id: 'li-catalog',
          kind: 'product',
          productId: '',
          catalogProductId: '507f1f77bcf86cd799439012',
          serviceId: '',
          name: 'USB hub',
          price: '400',
          quantity: '1',
          warrantyPeriod: '0',
        },
        {
          id: 'li-manual',
          kind: 'product',
          productId: '',
          catalogProductId: '',
          name: 'Manual item',
          price: '200',
          quantity: '2',
          warrantyPeriod: '0',
        },
      ],
    });

    expect(result.productId).toBe('');
    expect(result.lineItems).toEqual([
      expect.objectContaining({
        id: 'li-catalog',
        productId: undefined,
        catalogProductId: '507f1f77bcf86cd799439012',
        serviceId: undefined,
      }),
      expect.objectContaining({
        id: 'li-manual',
        productId: undefined,
        catalogProductId: undefined,
      }),
    ]);
  });
});

describe('normalizeSettingsPayload', () => {
  it('normalizes print forms and nested settings', () => {
    const result = normalizeSettingsPayload({
      serviceName: '  Repair CRM  ',
      company: '  Repair Company  ',
      companyAddress: '  Kyiv, Main street 1  ',
      companyId: '  12345678  ',
      companyIban: '  UA123456789123456789123456789  ',
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
      company: 'Repair Company',
      companyAddress: 'Kyiv, Main street 1',
      companyId: '12345678',
      companyIban: 'UA123456789123456789123456789',
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

  it('normalizes label sizes for label print forms', () => {
    const result = normalizeSettingsPayload({
      printForms: [
        {
          title: 'Barcode',
          content: '{{barcode}}',
          pageSize: 'label',
          labelSize: {
            presetId: 'custom',
            widthMm: '200',
            heightMm: '5',
          },
        },
        {
          title: 'Legacy barcode',
          content: '{{barcode}}',
          pageSize: 'label',
        },
      ],
    });

    expect(result.printForms[0].labelSize).toEqual({
      presetId: 'custom',
      widthMm: 120,
      heightMm: 10,
    });
    expect(result.printForms[1].labelSize).toEqual({
      presetId: '25x40',
      widthMm: 25,
      heightMm: 40,
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
    expect(result.company).toBe('Service CRM');
    expect(result.companyAddress).toBe('');
    expect(result.companyId).toBe('');
    expect(result.companyIban).toBe('');
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
