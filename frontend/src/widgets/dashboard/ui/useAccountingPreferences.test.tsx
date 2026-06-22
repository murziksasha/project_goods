import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cashbox } from '../../../entities/finance/model/types';
import {
  accountingCashboxOrderStorageKey,
  accountingExpandedFinanceSettingsCardStorageKey,
  accountingFinanceSettingsTabStorageKey,
  accountingLastTargetCashboxByTypeStorageKey,
  accountingSettingsOpenStorageKey,
  accountingTabStorageKey,
} from '../model/accounting';
import { useAccountingPreferences } from './useAccountingPreferences';

const cashbox = (id: string): Cashbox => ({
  id,
  name: id,
  balances: { UAH: 0 },
  enabledCurrencies: { UAH: true },
  isDefault: false,
  isArchived: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
});

const Harness = ({
  cashboxes = [],
  isCashboxesOrderHydrated = false,
}: {
  cashboxes?: Cashbox[];
  isCashboxesOrderHydrated?: boolean;
}) => {
  const preferences = useAccountingPreferences({
    cashboxes,
    isCashboxesOrderHydrated,
  });

  return (
    <section>
      <span data-testid='active-tab'>{preferences.activeTab}</span>
      <span data-testid='settings-open'>
        {String(preferences.isFinanceSettingsOpen)}
      </span>
      <span data-testid='settings-tab'>{preferences.financeSettingsTab}</span>
      <span data-testid='expanded'>{preferences.expandedFinanceSettingsCard ?? '-'}</span>
      <span data-testid='targets'>
        {JSON.stringify(preferences.lastTargetCashboxByType)}
      </span>
      <button type='button' onClick={() => preferences.setActiveTab('reports')}>
        reports
      </button>
      <button
        type='button'
        onClick={() => preferences.setIsFinanceSettingsOpen((current) => !current)}
      >
        toggle settings
      </button>
      <button
        type='button'
        onClick={() => preferences.setFinanceSettingsTab('currencies')}
      >
        currencies
      </button>
      <button
        type='button'
        onClick={() => preferences.setExpandedFinanceSettingsCard('cashboxes')}
      >
        expand
      </button>
      <button
        type='button'
        onClick={() => preferences.setExpandedFinanceSettingsCard(null)}
      >
        collapse
      </button>
      <button
        type='button'
        onClick={() =>
          preferences.setLastTargetCashboxByType({
            deposit: 'cashbox-1',
            transfer: 'cashbox-2',
          })
        }
      >
        targets
      </button>
    </section>
  );
};

describe('useAccountingPreferences', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('initializes from URL first and persists preference changes', () => {
    window.localStorage.setItem(accountingTabStorageKey, 'orders');
    window.localStorage.setItem(accountingSettingsOpenStorageKey, 'true');
    window.localStorage.setItem(accountingFinanceSettingsTabStorageKey, 'currencies');
    window.localStorage.setItem(
      accountingExpandedFinanceSettingsCardStorageKey,
      'cashbox-card',
    );
    window.localStorage.setItem(
      accountingLastTargetCashboxByTypeStorageKey,
      JSON.stringify({
        deposit: 'cashbox-1',
        transfer: 'cashbox-2',
        withdraw: 'ignored',
      }),
    );
    window.history.replaceState(null, '', '/?accountingTab=transactions');

    render(
      <Harness
        cashboxes={[cashbox('cashbox-2'), cashbox('cashbox-1')]}
        isCashboxesOrderHydrated
      />,
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('transactions');
    expect(screen.getByTestId('settings-open')).toHaveTextContent('true');
    expect(screen.getByTestId('settings-tab')).toHaveTextContent('currencies');
    expect(screen.getByTestId('expanded')).toHaveTextContent('cashbox-card');
    expect(screen.getByTestId('targets')).toHaveTextContent(
      '{"deposit":"cashbox-1","transfer":"cashbox-2"}',
    );
    expect(window.localStorage.getItem(accountingCashboxOrderStorageKey)).toBe(
      JSON.stringify(['cashbox-2', 'cashbox-1']),
    );

    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports');
    expect(window.localStorage.getItem(accountingTabStorageKey)).toBe('reports');
    expect(window.location.search).toBe('?accountingTab=reports');

    fireEvent.click(screen.getByRole('button', { name: 'toggle settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'currencies' }));
    fireEvent.click(screen.getByRole('button', { name: 'expand' }));
    fireEvent.click(screen.getByRole('button', { name: 'targets' }));

    expect(window.localStorage.getItem(accountingSettingsOpenStorageKey)).toBe(
      'false',
    );
    expect(window.localStorage.getItem(accountingFinanceSettingsTabStorageKey)).toBe(
      'currencies',
    );
    expect(
      window.localStorage.getItem(accountingExpandedFinanceSettingsCardStorageKey),
    ).toBe('cashboxes');
    expect(
      window.localStorage.getItem(accountingLastTargetCashboxByTypeStorageKey),
    ).toBe('{"deposit":"cashbox-1","transfer":"cashbox-2"}');

    fireEvent.click(screen.getByRole('button', { name: 'collapse' }));
    expect(
      window.localStorage.getItem(accountingExpandedFinanceSettingsCardStorageKey),
    ).toBeNull();
  });

  it('falls back for invalid stored values and syncs from popstate', async () => {
    window.localStorage.setItem(accountingTabStorageKey, 'bad');
    window.localStorage.setItem(accountingFinanceSettingsTabStorageKey, 'bad');
    window.localStorage.setItem(
      accountingLastTargetCashboxByTypeStorageKey,
      JSON.stringify({ deposit: 123, transfer: null }),
    );

    render(<Harness />);

    expect(screen.getByTestId('active-tab')).toHaveTextContent('cashboxes');
    expect(screen.getByTestId('settings-tab')).toHaveTextContent('cashboxes');
    expect(screen.getByTestId('targets')).toHaveTextContent('{}');

    window.history.replaceState(null, '', '/?accountingTab=orders');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() =>
      expect(screen.getByTestId('active-tab')).toHaveTextContent('orders'),
    );
  });

  it('ignores popstate without a valid accounting tab', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    window.history.replaceState(null, '', '/?accountingTab=bad');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports');
  });

  it('does not persist cashbox order before hydration or with empty cashboxes', () => {
    render(<Harness cashboxes={[cashbox('cashbox-1')]} />);

    expect(window.localStorage.getItem(accountingCashboxOrderStorageKey)).toBeNull();

    cleanup();
    render(<Harness isCashboxesOrderHydrated />);

    expect(window.localStorage.getItem(accountingCashboxOrderStorageKey)).toBeNull();
  });

  it('survives localStorage and history failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      throw new Error('history unavailable');
    });

    render(
      <Harness
        cashboxes={[cashbox('cashbox-1')]}
        isCashboxesOrderHydrated
      />,
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('cashboxes');
    expect(screen.getByTestId('settings-open')).toHaveTextContent('false');
    expect(screen.getByTestId('settings-tab')).toHaveTextContent('cashboxes');
    expect(screen.getByTestId('expanded')).toHaveTextContent('-');
    expect(screen.getByTestId('targets')).toHaveTextContent('{}');

    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'currencies' }));
    fireEvent.click(screen.getByRole('button', { name: 'expand' }));
    fireEvent.click(screen.getByRole('button', { name: 'collapse' }));
    fireEvent.click(screen.getByRole('button', { name: 'targets' }));

    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports');
  });

  it('falls back when stored target memory is malformed', () => {
    window.localStorage.setItem(
      accountingLastTargetCashboxByTypeStorageKey,
      '{bad json',
    );

    render(<Harness />);

    expect(screen.getByTestId('targets')).toHaveTextContent('{}');
  });
});
