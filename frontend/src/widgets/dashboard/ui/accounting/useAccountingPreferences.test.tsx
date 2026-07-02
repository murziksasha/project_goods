import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cashbox } from '../../../../entities/finance/model/types';
import {
  accountingCashboxOrderStorageKey,
  accountingExpandedFinanceSettingsCardStorageKey,
  accountingFinanceSettingsTabStorageKey,
  accountingLastOperationByCashboxStorageKey,
  accountingLastTargetCashboxByTypeStorageKey,
  accountingSettingsOpenStorageKey,
  accountingTabStorageKey,
} from '../../model/accounting';
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
  onNavigateAccountingTab,
  registerPopstateSync,
  syncedAccountingTab = null,
}: {
  cashboxes?: Cashbox[];
  isCashboxesOrderHydrated?: boolean;
  onNavigateAccountingTab?: (tab: 'cashboxes' | 'transactions' | 'orders' | 'reports') => void;
  registerPopstateSync?: (
    sync: ((tab: 'cashboxes' | 'transactions' | 'orders' | 'reports' | null) => void) | null,
  ) => void;
  syncedAccountingTab?: 'cashboxes' | 'transactions' | 'orders' | 'reports' | null;
}) => {
  const preferences = useAccountingPreferences({
    cashboxes,
    isCashboxesOrderHydrated,
    onNavigateAccountingTab,
    registerPopstateSync,
    syncedAccountingTab,
  });

  return (
    <section>
      <span data-testid='active-tab'>{preferences.activeTab}</span>
      <span data-testid='settings-open'>
        {String(preferences.isFinanceSettingsOpen)}
      </span>
      <span data-testid='settings-tab'>{preferences.financeSettingsTab}</span>
      <span data-testid='expanded'>{preferences.expandedFinanceSettingsCard ?? '-'}</span>
      <span data-testid='memory'>
        {JSON.stringify(preferences.lastOperationByCashbox)}
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
          preferences.setLastOperationByCashbox({
            'cashbox-1': {
              deposit: {
                fromCashboxId: '',
                toCashboxId: 'cashbox-1',
                currency: 'UAH',
              },
              transfer: {
                fromCashboxId: 'cashbox-1',
                toCashboxId: 'cashbox-2',
                currency: 'UAH',
              },
            },
          })
        }
      >
        memory
      </button>
    </section>
  );
};

describe('useAccountingPreferences', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('initializes from URL first and persists preference changes', () => {
    const onNavigateAccountingTab = vi.fn();
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
        onNavigateAccountingTab={onNavigateAccountingTab}
      />,
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('transactions');
    expect(screen.getByTestId('settings-open')).toHaveTextContent('true');
    expect(screen.getByTestId('settings-tab')).toHaveTextContent('currencies');
    expect(screen.getByTestId('expanded')).toHaveTextContent('cashbox-card');
    expect(screen.getByTestId('memory')).toHaveTextContent(
      JSON.stringify({
        'cashbox-1': {
          deposit: {
            fromCashboxId: '',
            toCashboxId: 'cashbox-1',
            currency: 'UAH',
          },
          transfer: {
            fromCashboxId: 'cashbox-1',
            toCashboxId: 'cashbox-2',
            currency: 'UAH',
          },
        },
      }),
    );
    expect(window.localStorage.getItem(accountingCashboxOrderStorageKey)).toBe(
      JSON.stringify(['cashbox-2', 'cashbox-1']),
    );

    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports');
    expect(window.localStorage.getItem(accountingTabStorageKey)).toBe('reports');
    expect(onNavigateAccountingTab).toHaveBeenCalledWith('reports');

    fireEvent.click(screen.getByRole('button', { name: 'toggle settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'currencies' }));
    fireEvent.click(screen.getByRole('button', { name: 'expand' }));
    fireEvent.click(screen.getByRole('button', { name: 'memory' }));

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
      window.localStorage.getItem(accountingLastOperationByCashboxStorageKey),
    ).toBe(
      JSON.stringify({
        'cashbox-1': {
          deposit: {
            fromCashboxId: '',
            toCashboxId: 'cashbox-1',
            currency: 'UAH',
          },
          transfer: {
            fromCashboxId: 'cashbox-1',
            toCashboxId: 'cashbox-2',
            currency: 'UAH',
          },
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'collapse' }));
    expect(
      window.localStorage.getItem(accountingExpandedFinanceSettingsCardStorageKey),
    ).toBeNull();
  });

  it('falls back for invalid stored values and syncs from history callbacks', async () => {
    const popstateSyncHolder: {
      current: ((tab: 'cashboxes' | 'transactions' | 'orders' | 'reports' | null) => void) | null;
    } = { current: null };

    window.localStorage.setItem(accountingTabStorageKey, 'bad');
    window.localStorage.setItem(accountingFinanceSettingsTabStorageKey, 'bad');
    window.localStorage.setItem(
      accountingLastTargetCashboxByTypeStorageKey,
      JSON.stringify({ deposit: 123, transfer: null }),
    );

    render(
      <Harness
        registerPopstateSync={(sync) => {
          popstateSyncHolder.current = sync;
        }}
      />,
    );

    expect(screen.getByTestId('active-tab')).toHaveTextContent('cashboxes');
    expect(screen.getByTestId('settings-tab')).toHaveTextContent('cashboxes');
    expect(screen.getByTestId('memory')).toHaveTextContent('{}');

    popstateSyncHolder.current?.('orders');

    await waitFor(() =>
      expect(screen.getByTestId('active-tab')).toHaveTextContent('orders'),
    );
  });

  it('syncs from syncedAccountingTab prop', async () => {
    const { rerender } = render(<Harness syncedAccountingTab='transactions' />);

    await waitFor(() =>
      expect(screen.getByTestId('active-tab')).toHaveTextContent('transactions'),
    );

    rerender(<Harness syncedAccountingTab='reports' />);

    await waitFor(() =>
      expect(screen.getByTestId('active-tab')).toHaveTextContent('reports'),
    );
  });

  it('ignores popstate sync without a valid accounting tab', () => {
    const popstateSyncHolder: {
      current: ((tab: 'cashboxes' | 'transactions' | 'orders' | 'reports' | null) => void) | null;
    } = { current: null };

    render(
      <Harness
        registerPopstateSync={(sync) => {
          popstateSyncHolder.current = sync;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    popstateSyncHolder.current?.(null);

    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports');
  });

  it('does not persist cashbox order before hydration or with empty cashboxes', () => {
    render(<Harness cashboxes={[cashbox('cashbox-1')]} />);

    expect(window.localStorage.getItem(accountingCashboxOrderStorageKey)).toBeNull();

    cleanup();
    render(<Harness isCashboxesOrderHydrated />);

    expect(window.localStorage.getItem(accountingCashboxOrderStorageKey)).toBeNull();
  });

  it('survives localStorage failures', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
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
    expect(screen.getByTestId('memory')).toHaveTextContent('{}');

    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'currencies' }));
    fireEvent.click(screen.getByRole('button', { name: 'expand' }));
    fireEvent.click(screen.getByRole('button', { name: 'collapse' }));
    fireEvent.click(screen.getByRole('button', { name: 'memory' }));

    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports');
  });

  it('falls back when stored target memory is malformed', () => {
    window.localStorage.setItem(
      accountingLastTargetCashboxByTypeStorageKey,
      '{bad json',
    );

    render(<Harness />);

    expect(screen.getByTestId('memory')).toHaveTextContent('{}');
  });
});