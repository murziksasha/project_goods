import { describe, expect, it } from 'vitest';
import { renderPrintTemplate } from './printForms';

const templateData = {
  orderNumber: 'r000124',
  clientName: 'Ivan',
  clientPhone: '+380671112233',
  deviceName: 'iPhone',
  serialNumber: 'SN-1',
  article: 'IPH',
  total: '100 UAH',
  paid: '20 UAH',
  toPay: '80 UAH',
  note: 'Battery',
  managerName: 'Manager',
  masterName: 'Master',
  createdAt: '29.05.2026 10:30',
};

describe('renderPrintTemplate', () => {
  it('renders supported print variables', () => {
    expect(
      renderPrintTemplate(
        '{{orderNumber}} {{clientName}} {{deviceName}} {{total}} {{masterName}}',
        templateData,
      ),
    ).toBe('r000124 Ivan iPhone 100 UAH Master');
  });

  it('leaves unknown variables visible', () => {
    expect(
      renderPrintTemplate('Order {{orderNumber}} {{unknownValue}}', templateData),
    ).toBe('Order r000124 {{unknownValue}}');
  });
});
