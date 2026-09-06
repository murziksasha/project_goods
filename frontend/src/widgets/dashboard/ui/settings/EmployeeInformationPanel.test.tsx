import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import type { Employee } from '../../../../entities/employee/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import i18n from '../../../../shared/i18n/config';
import { EmployeeInformationPanel } from './EmployeeInformationPanel';

afterEach(() => {
  cleanup();
});

const activeEmployee: Employee = {
  id: 'employee-1',
  name: 'Manager One',
  phone: '',
  email: '',
  username: 'manager',
  role: 'manager',
  permissions: ['orders.manage'],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('EmployeeInformationPanel', () => {
  it('renders KPI labels, localized roles, and table data-labels', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeInformationPanel employees={[activeEmployee]} sales={[]} />
      </I18nextProvider>,
    );

    const kpis = document.querySelector('.employees-information-kpis');
    expect(kpis).not.toBeNull();
    expect(kpis).toHaveTextContent('Active employees');
    expect(kpis).toHaveTextContent('Sales revenue');
    expect(kpis).toHaveTextContent('Repairs revenue');
    expect(screen.getByRole('option', { name: 'Manager' })).toHaveValue(
      'manager',
    );
    expect(screen.queryByRole('option', { name: 'manager' })).toBeNull();

    const roleCell = document.querySelector(
      'td[data-label="Role"]',
    ) as HTMLElement | null;
    expect(roleCell).not.toBeNull();
    expect(roleCell?.textContent).toContain('Manager');
    expect(
      document.querySelector('td[data-label="Employee"]'),
    ).not.toBeNull();
  });

  it('counts historical sales on the default Whole period', () => {
    const sale: Sale = {
      id: 'sale-1',
      recordNumber: 'R000001',
      saleDate: '2026-05-12T10:00:00.000Z',
      quantity: 1,
      salePrice: 250,
      kind: 'sale',
      status: 'issued',
      paidAmount: 250,
      note: '',
      timeline: [],
      paymentHistory: [],
      lineItems: [],
      client: {
        id: 'client-1',
        name: 'Client',
        phone: '+380000000000',
        status: 'ok',
      },
      product: null,
      manager: {
        id: 'employee-1',
        name: 'Manager One',
        role: 'manager',
      },
      master: null,
      issuedBy: null,
      createdAt: '2026-05-12T10:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    };

    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeInformationPanel employees={[activeEmployee]} sales={[sale]} />
      </I18nextProvider>,
    );

    const kpis = document.querySelector('.employees-information-kpis');
    expect(kpis).toHaveTextContent('250');
    expect(kpis).toHaveTextContent('Orders in period');
    expect(kpis?.querySelector('.analytics-kpi-volume')?.textContent).toMatch(
      /Orders in period\s*1/,
    );
    expect(screen.getByRole('button', { name: 'Whole' })).toHaveClass(
      'period-button-active',
    );
  });
});
