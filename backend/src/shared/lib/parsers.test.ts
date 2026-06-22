import { describe, expect, it } from 'vitest';
import { employeePermissions } from '../../domain/employee/constants';
import {
  normalizeClientPayload,
  normalizeEmployeePayload,
  normalizeProductPayload,
  normalizeSalePayload,
  normalizeSettingsPayload,
  toNumber,
} from './parsers';

describe('toNumber', () => {
  it('accepts comma and dot decimals', () => {
    expect(toNumber('834,48')).toBe(834.48);
    expect(toNumber('834.48')).toBe(834.48);
    expect(toNumber('0,01')).toBe(0.01);
    expect(toNumber('834,')).toBe(834);
  });

  it('rejects malformed decimal strings', () => {
    expect(toNumber('abc')).toBeNaN();
    expect(toNumber('1,2,3')).toBeNaN();
  });
});

describe('normalizeProductPayload', () => {
  it('normalizes scalar fields and filters invalid sale prices', () => {
    const result = normalizeProductPayload({
      name: '  Mouse  ',
      article: ' ab-1 ',
      serialNumber: ' sn-99 ',
      price: '2500,50',
      salePriceOptions: '1200,50, -1, foo, 1500.25',
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
      price: 2500.5,
      salePriceOptions: [1200.5, 1500.25],
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
        'orders.chat',
        'supplierOrders.view',
        'supplierOrders.manage',
        'clients.manage',
        'inventory.manage',
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
        'supplierOrders.view',
        'supplierOrders.manage',
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

  it('adds warehouse access to manager defaults', () => {
    const defaults = normalizeEmployeePayload({
      name: 'Default Manager',
      username: 'default-manager',
      password: 'pass',
      role: 'manager',
      permissions: [],
    });

    expect(defaults.permissions).toEqual(
      expect.arrayContaining([
        'orders.view',
        'orders.manage',
        'orders.chat',
        'supplierOrders.view',
        'supplierOrders.manage',
        'inventory.manage',
      ]),
    );
  });

  it('adds orders.chat to master defaults', () => {
    const defaults = normalizeEmployeePayload({
      name: 'Default Master',
      username: 'default-master',
      password: 'pass',
      role: 'master',
      permissions: [],
    });

    expect(defaults.permissions).toEqual(
      expect.arrayContaining([
        'orders.view',
        'orders.chat',
        'repairs.execute',
      ]),
    );
  });

  it('accepts supplier-order permissions and applies supplier defaults', () => {
    const parsed = normalizeEmployeePayload({
      name: 'Supplier manager',
      username: 'supplier-manager',
      password: 'pass',
      role: 'manager',
      permissions: [
        'supplierOrders.view',
        'supplierOrders.manage',
        'finance.supplierOrders.pay',
        'invalid.permission',
      ],
    });

    expect(parsed.permissions).toEqual([
      'supplierOrders.view',
      'supplierOrders.manage',
      'finance.supplierOrders.pay',
    ]);

    const warehouseDefaults = normalizeEmployeePayload({
      name: 'Warehouse',
      username: 'warehouse',
      password: 'pass',
      role: 'warehouse',
      permissions: [],
    });

    expect(warehouseDefaults.permissions).toEqual(
      expect.arrayContaining([
        'supplierOrders.view',
        'supplierOrders.manage',
        'inventory.manage',
      ]),
    );
  });

  it('applies every permission to owner defaults', () => {
    const defaults = normalizeEmployeePayload({
      name: 'Owner',
      username: 'owner',
      password: 'pass',
      role: 'owner',
      permissions: [],
    });

    expect(defaults.permissions).toEqual([...employeePermissions]);
    expect(defaults.permissions).toContain('supplierOrders.view');
    expect(defaults.permissions).toContain('supplierOrders.manage');
    expect(defaults.permissions).toContain('system.backups.manage');
  });

  it('keeps employees.manage for owner even when an explicit payload omits it', () => {
    const parsed = normalizeEmployeePayload({
      name: 'Owner',
      username: 'owner',
      password: 'pass',
      role: 'owner',
      permissions: ['orders.view'],
    });

    expect(parsed.permissions).toEqual(['orders.view', 'employees.manage']);
  });
});

describe('normalizeClientPayload', () => {
  it('normalizes structured client requisites', () => {
    const result = normalizeClientPayload({
      phone: ' +38 (067) 111-22-33 ',
      name: ' Ivan Petrenko ',
      email: ' ivan@example.com ',
      address: ' Kyiv, Main street 1 ',
      registrationId: ' 12345678 ',
      iban: ' ua12 3456 7891 2345 6789 1234 5678 9 ',
      note: ' Note ',
      status: 'vip',
    });

    expect(result).toMatchObject({
      phone: '+380671112233',
      name: 'Ivan Petrenko',
      email: 'ivan@example.com',
      address: 'Kyiv, Main street 1',
      registrationId: '12345678',
      iban: 'UA123456789123456789123456789',
      note: 'Note',
      status: 'vip',
    });
  });

  it('preserves empty status for auto-managed clients', () => {
    const result = normalizeClientPayload({
      phone: '+380671112233',
      name: 'Ivan Petrenko',
      status: '',
    });

    expect(result.status).toBe('');
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
      companyEmail: '  billing@example.com  ',
      companySite: '  https://example.com  ',
      printForms: [
        {
          id: ' receipt ',
          title: ' Receipt ',
          type: ' receipt ',
          content: ' Order {{orderNumber}} ',
          contentFormat: 'html',
          layoutVersion: 1,
          layoutBlocks: [
            { id: 'heading-1', type: 'heading', text: 'Receipt {{orderNumber}}' },
            null,
            'bad',
          ],
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
      companyEmail: 'billing@example.com',
      companySite: 'https://example.com',
      printForms: [
        {
          id: 'receipt',
          title: 'Receipt',
          type: 'receipt',
          content: 'Order {{orderNumber}}',
          contentFormat: 'html',
          layoutVersion: 1,
          layoutBlocks: [
            { id: 'heading-1', type: 'heading', text: 'Receipt {{orderNumber}}' },
          ],
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
    expect(result.companyEmail).toBe('');
    expect(result.companySite).toBe('');
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
