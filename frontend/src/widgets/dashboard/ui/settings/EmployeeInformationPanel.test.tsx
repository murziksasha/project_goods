import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import type { Employee } from '../../../../entities/employee';
import type { Sale } from '../../../../entities/sale';
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

  it('renders Top Performers and Top 3 as independent collapsible sections with persistence and isolation', () => {
    window.localStorage.clear();

    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeInformationPanel
          employees={[activeEmployee]}
          sales={[]}
          currentEmployeeId="emp-1"
        />
      </I18nextProvider>,
    );

    // 1. Both headers are accessible as buttons and open by default
    const performersBtn = screen.getByRole('button', {
      name: /Top Performers/i,
    });
    const topThreeBtn = screen.getByRole('button', {
      name: /Top 3/i,
    });
    expect(performersBtn).toHaveAttribute('aria-expanded', 'true');
    expect(performersBtn).toHaveAttribute(
      'aria-controls',
      'employees-top-performers-content',
    );
    expect(topThreeBtn).toHaveAttribute('aria-expanded', 'true');
    expect(topThreeBtn).toHaveAttribute(
      'aria-controls',
      'employees-top-three-content',
    );

    const performersContent = document.getElementById(
      'employees-top-performers-content',
    );
    const topThreeContent = document.getElementById(
      'employees-top-three-content',
    );
    expect(performersContent).not.toHaveAttribute('hidden');
    expect(topThreeContent).not.toHaveAttribute('hidden');

    // 2. Mouse click collapses Top Performers independently
    fireEvent.click(performersBtn);
    expect(performersBtn).toHaveAttribute('aria-expanded', 'false');
    expect(performersContent).toHaveAttribute('hidden');
    // Sibling card remains open
    expect(topThreeBtn).toHaveAttribute('aria-expanded', 'true');
    expect(topThreeContent).not.toHaveAttribute('hidden');

    // 3. Space key collapses Top 3
    fireEvent.keyDown(topThreeBtn, { key: ' ', code: 'Space' });
    fireEvent.click(topThreeBtn);
    expect(topThreeBtn).toHaveAttribute('aria-expanded', 'false');
    expect(topThreeContent).toHaveAttribute('hidden');

    // 4. Enter key re-expands Top 3
    fireEvent.keyDown(topThreeBtn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(topThreeBtn);
    expect(topThreeBtn).toHaveAttribute('aria-expanded', 'true');
    expect(topThreeContent).not.toHaveAttribute('hidden');

    // 5. Switching Employee view retains collapse state
    const salesViewBtn = screen.getByRole('button', { name: 'Sales' });
    fireEvent.click(salesViewBtn);
    const performersBtnInSales = screen.getByRole('button', {
      name: /Top Performers/i,
    });
    expect(performersBtnInSales).toHaveAttribute('aria-expanded', 'false');

    // 6. Remount preserves collapsed state for emp-1
    cleanup();
    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeInformationPanel
          employees={[activeEmployee]}
          sales={[]}
          currentEmployeeId="emp-1"
        />
      </I18nextProvider>,
    );
    expect(
      screen.getByRole('button', { name: /Top Performers/i }),
    ).toHaveAttribute('aria-expanded', 'false');

    // 7. Isolation for emp-2 (defaults to expanded)
    cleanup();
    render(
      <I18nextProvider i18n={i18n}>
        <EmployeeInformationPanel
          employees={[activeEmployee]}
          sales={[]}
          currentEmployeeId="emp-2"
        />
      </I18nextProvider>,
    );
    expect(
      screen.getByRole('button', { name: /Top Performers/i }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
