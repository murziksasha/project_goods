import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cashbox, CreateFinanceTransactionPayload } from '../../../../entities/finance/model/types';
import {
  accountingHideEmptyCashboxesStorageKey,
  type CashboxCurrencyRow,
} from '../../model/accounting';
import { AccountingCashboxesView } from './AccountingCashboxesView';

const cashbox = (patch: Partial<Cashbox> = {}): Cashbox => ({
  id: 'cashbox-1',
  name: 'Main cashbox',
  balances: { UAH: 1250, USD: 40 },
  enabledCurrencies: { UAH: true, USD: true },
  isDefault: false,
  isArchived: false,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  ...patch,
});

const transactionForm = (
  patch: Partial<CreateFinanceTransactionPayload> = {},
): CreateFinanceTransactionPayload => ({
  type: 'deposit',
  amount: '100',
  currency: 'UAH',
  fromCashboxId: '',
  toCashboxId: 'cashbox-1',
  note: '',
  ...patch,
});

const openOperation = () => {
  fireEvent.click(screen.getAllByRole('button', { name: 'Operation' })[0]);
};

const renderView = (
  patch: Partial<ComponentProps<typeof AccountingCashboxesView>> = {},
) => {
  const rowsByCashbox = new Map<string, CashboxCurrencyRow[]>(
    (patch.cashboxes ?? []).map((item) => [item.id, []]),
  );
  const props: ComponentProps<typeof AccountingCashboxesView> = {
    allowedTransactionCurrencies: ['UAH', 'USD'],
    allCurrencyCodes: ['UAH', 'USD'],
    canCreateDeposit: true,
    canCreateTransfer: true,
    canCreateWithdraw: true,
    canManageCashboxes: true,
    cashboxes: [
      cashbox({ id: 'cashbox-1', name: 'Main cashbox', isDefault: true }),
      cashbox({ id: 'cashbox-2', name: 'Reserve cashbox', balances: { UAH: 0 } }),
    ],
    cashboxCurrencyRows: (item) =>
      rowsByCashbox.get(item.id) ?? [
        { currency: 'UAH', balance: item.balances.UAH ?? 0, canAccept: true, canWithdraw: true },
        { currency: 'USD', balance: item.balances.USD ?? 0, canAccept: false, canWithdraw: true },
      ],
    draggedCashboxId: null,
    isSaving: false,
    permittedTransactionTypes: ['deposit', 'withdraw', 'transfer'],
    totals: { UAH: 1250, USD: 40, EUR: 0 },
    transactionForm: transactionForm(),
    onCreateCashbox: vi.fn(),
    onCreateTransaction: vi.fn(),
    onOpenCashboxTransactions: vi.fn(),
    onSetCashboxes: vi.fn(),
    onSetDraggedCashboxId: vi.fn(),
    onStartTransaction: vi.fn(),
    onTransactionFormChange: vi.fn(),
    onTransactionTypeChange: vi.fn(),
    ...patch,
  };

  return {
    ...render(<AccountingCashboxesView {...props} />),
    props,
  };
};

describe('AccountingCashboxesView', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    window.localStorage.removeItem(accountingHideEmptyCashboxesStorageKey);
  });

  it('renders totals, cashbox balances and compact actions', () => {
    const { props } = renderView();

    expect(screen.getByText('1,250.00 UAH')).toBeInTheDocument();
    expect(screen.getAllByText('40.00 USD')).toHaveLength(2);
    expect(screen.queryByText('0.00 EUR')).not.toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getAllByText('Withdraw only')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add cashbox' })).toBeInTheDocument();
    expect(screen.getByText('2 cashboxes')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Operation' })[0]);
    expect(props.onStartTransaction).toHaveBeenCalledWith(
      'deposit',
      props.cashboxes[0],
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Transactions' })[0]);
    expect(props.onOpenCashboxTransactions).toHaveBeenCalledWith(
      props.cashboxes[0],
    );
  });

  it('filters cashboxes by search and hide-empty', () => {
    renderView();

    fireEvent.change(screen.getByPlaceholderText('Search cashboxes'), {
      target: { value: 'reserve' },
    });
    expect(screen.queryByTitle('Main cashbox')).not.toBeInTheDocument();
    expect(screen.getByTitle('Reserve cashbox')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search cashboxes'), {
      target: { value: 'zzz' },
    });
    expect(screen.getByText('No cashboxes match the search.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search cashboxes'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide empty' }));
    expect(screen.queryByTitle('Reserve cashbox')).not.toBeInTheDocument();
    expect(screen.getByTitle('Main cashbox')).toBeInTheDocument();
    expect(
      window.localStorage.getItem(accountingHideEmptyCashboxesStorageKey),
    ).toBe('true');
  });

  it('restores hide-empty from localStorage', () => {
    window.localStorage.setItem(accountingHideEmptyCashboxesStorageKey, 'true');
    renderView();
    expect(screen.getByRole('checkbox', { name: 'Hide empty' })).toBeChecked();
    expect(screen.queryByTitle('Reserve cashbox')).not.toBeInTheDocument();
    expect(screen.getByTitle('Main cashbox')).toBeInTheDocument();
  });

  it('keeps hide-empty working when localStorage writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    renderView();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide empty' }));
    expect(screen.getByRole('checkbox', { name: 'Hide empty' })).toBeChecked();
    expect(screen.queryByTitle('Reserve cashbox')).not.toBeInTheDocument();
  });

  it('opens the operation modal from a card click and saves', () => {
    const { props } = renderView();
    fireEvent.click(document.querySelectorAll('.finance-cashbox-card')[0]);
    expect(props.onStartTransaction).toHaveBeenCalledWith(
      'deposit',
      props.cashboxes[0],
    );
    expect(screen.getByRole('button', { name: 'Save operation' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save operation' }));
    expect(props.onCreateTransaction).toHaveBeenCalledTimes(1);
  });

  it('hides unauthorized controls and renders empty balances', () => {
    renderView({
      canCreateDeposit: false,
      canCreateTransfer: false,
      canCreateWithdraw: false,
      canManageCashboxes: false,
      cashboxes: [cashbox({ balances: {} })],
      cashboxCurrencyRows: () => [],
      permittedTransactionTypes: [],
      totals: { UAH: 0, USD: 0 },
    });

    expect(screen.queryByRole('button', { name: 'Add cashbox' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Operation' })).not.toBeInTheDocument();
    expect(screen.queryByText('Operation')).not.toBeInTheDocument();
    expect(screen.getByText('No active currency balances')).toBeInTheDocument();
    fireEvent.click(document.querySelectorAll('.finance-cashbox-card')[0]);
    expect(screen.queryByRole('button', { name: 'Save operation' })).not.toBeInTheDocument();
  });

  it('treats cashboxes with no currency rows as empty', () => {
    renderView({
      cashboxes: [
        cashbox({ id: 'cashbox-1', name: 'Main cashbox', isDefault: true }),
        cashbox({ id: 'cashbox-2', name: 'Empty rows' }),
      ],
      cashboxCurrencyRows: (item) =>
        item.id === 'cashbox-2'
          ? []
          : [
              {
                currency: 'UAH',
                balance: 1250,
                canAccept: true,
                canWithdraw: true,
              },
            ],
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide empty' }));
    expect(screen.queryByTitle('Empty rows')).not.toBeInTheDocument();
    expect(screen.getByTitle('Main cashbox')).toBeInTheDocument();
  });

  it('shows an empty state when there are no cashboxes', () => {
    renderView({ cashboxes: [] });
    expect(
      screen.getByText('No cashboxes yet. Create one in Accounting settings.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add cashbox' })[0]);
    expect(screen.getByPlaceholderText('New cashbox')).toBeInTheDocument();
  });

  it('creates a cashbox from the toolbar modal', async () => {
    const onCreateCashbox = vi.fn().mockResolvedValue({ id: 'new' });
    renderView({ onCreateCashbox });
    fireEvent.click(screen.getByRole('button', { name: 'Add cashbox' }));
    fireEvent.change(screen.getByPlaceholderText('New cashbox'), {
      target: { value: 'Front desk' },
    });
    fireEvent.click(screen.getByLabelText('USD'));
    fireEvent.click(screen.getByLabelText('UAH'));
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreateCashbox).toHaveBeenCalledWith('Front desk', {
      UAH: false,
      USD: true,
    });
    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText('New cashbox')).not.toBeInTheDocument();
    });
  });

  it('keeps the create modal open when create fails', () => {
    const onCreateCashbox = vi.fn().mockResolvedValue(undefined);
    renderView({ onCreateCashbox });
    fireEvent.click(screen.getByRole('button', { name: 'Add cashbox' }));
    fireEvent.change(screen.getByPlaceholderText('New cashbox'), {
      target: { value: 'Front desk' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByPlaceholderText('New cashbox')).toBeInTheDocument();
  });

  it('does not close the create modal while saving', () => {
    renderView({ isSaving: true });
    fireEvent.click(screen.getByRole('button', { name: 'Add cashbox' }));
    fireEvent.change(screen.getByPlaceholderText('New cashbox'), {
      target: { value: 'Front desk' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByPlaceholderText('New cashbox')).toBeInTheDocument();
  });

  it('updates transaction form fields and save state', () => {
    const { props } = renderView({
      allowedTransactionCurrencies: ['USD'],
      transactionForm: transactionForm({
        type: 'transfer',
        amount: '',
        currency: 'UAH',
        fromCashboxId: 'cashbox-1',
        toCashboxId: 'cashbox-2',
      }),
    });

    openOperation();

    fireEvent.change(screen.getByLabelText('Type', { selector: 'select' }), {
      target: { value: 'transfer' },
    });
    expect(props.onTransactionTypeChange).toHaveBeenCalledWith('transfer');

    fireEvent.change(screen.getByLabelText('Amount', { selector: 'input' }), {
      target: { value: '25.50' },
    });
    expect(props.onTransactionFormChange).toHaveBeenCalledWith(expect.any(Function));

    fireEvent.change(screen.getByLabelText('Currency', { selector: 'select' }), {
      target: { value: 'USD' },
    });
    fireEvent.change(screen.getByLabelText('From cashbox', { selector: 'select' }), {
      target: { value: 'cashbox-2' },
    });
    fireEvent.change(screen.getByLabelText('Comment', { selector: 'input' }), {
      target: { value: 'cash movement' },
    });
    expect(props.onTransactionFormChange).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save operation' })).toBeDisabled();
  });

  it('updates transaction note', () => {
    const current = transactionForm();
    let next: CreateFinanceTransactionPayload | null = null;
    const onTransactionFormChange = vi.fn(
      (
        updater:
          | CreateFinanceTransactionPayload
          | ((
              current: CreateFinanceTransactionPayload,
            ) => CreateFinanceTransactionPayload),
      ) => {
        next = typeof updater === 'function' ? updater(current) : updater;
      },
    );
    renderView({ onTransactionFormChange });
    openOperation();

    fireEvent.change(screen.getByLabelText('Comment', { selector: 'input' }), {
      target: { value: 'cash movement' },
    });

    expect(next).toEqual({ ...current, note: 'cash movement' });
  });

  it('hides from cashbox on deposit and shows saving/no-currency states', () => {
    renderView({
      allowedTransactionCurrencies: [],
      isSaving: true,
      transactionForm: transactionForm({ type: 'deposit', amount: '50' }),
    });
    openOperation();

    expect(screen.getByLabelText('Currency')).toBeDisabled();
    expect(screen.getByText('No available currencies')).toBeInTheDocument();
    expect(screen.queryByLabelText('From cashbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('uses zero when the source cashbox has no balance for the currency', () => {
    renderView({
      transactionForm: transactionForm({
        type: 'withdraw',
        amount: '10',
        currency: 'EUR',
        fromCashboxId: 'cashbox-1',
      }),
    });
    openOperation();
    expect(screen.getByText(/Available:/)).toBeInTheDocument();
    expect(screen.getByText('Amount exceeds the available balance.')).toBeInTheDocument();
  });

  it('hides destination cashbox when withdrawing', () => {
    renderView({
      transactionForm: transactionForm({
        type: 'withdraw',
        fromCashboxId: 'cashbox-1',
        toCashboxId: '',
      }),
    });
    openOperation();

    expect(screen.queryByLabelText('To cashbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Available:/)).toBeInTheDocument();
  });

  it('limits operation type options to granted permissions', () => {
    const { unmount } = renderView({
      canCreateDeposit: false,
      canCreateTransfer: true,
      canCreateWithdraw: false,
      permittedTransactionTypes: ['transfer'],
      transactionForm: transactionForm({ type: 'transfer' }),
    });

    openOperation();
    const typeSelect = screen.getByLabelText('Type', { selector: 'select' });
    expect(typeSelect).not.toHaveTextContent('Deposit');
    expect(typeSelect).not.toHaveTextContent('Withdraw');
    expect(typeSelect).toHaveTextContent('Transfer');

    unmount();
    renderView({
      canCreateDeposit: true,
      canCreateTransfer: false,
      canCreateWithdraw: true,
      permittedTransactionTypes: ['deposit', 'withdraw'],
    });
    openOperation();
    const limitedTypeSelect = screen.getByLabelText('Type', { selector: 'select' });
    expect(limitedTypeSelect).toHaveTextContent('Deposit');
    expect(limitedTypeSelect).toHaveTextContent('Withdraw');
    expect(limitedTypeSelect).not.toHaveTextContent('Transfer');
  });

  it('reorders cashboxes through drag and drop and handles ignored drops', () => {
    const onSetCashboxes = vi.fn();
    const onSetDraggedCashboxId = vi.fn();
    const { props, rerender } = renderView({
      draggedCashboxId: 'cashbox-1',
      onSetCashboxes,
      onSetDraggedCashboxId,
    });

    const cards = document.querySelectorAll('.finance-cashbox-card');
    fireEvent.dragStart(cards[0]);
    expect(onSetDraggedCashboxId).toHaveBeenCalledWith('cashbox-1');
    fireEvent.dragOver(cards[1]);

    fireEvent.drop(cards[1]);
    expect(onSetCashboxes).toHaveBeenCalledWith(expect.any(Function));
    const updater = onSetCashboxes.mock.calls[0][0] as (
      current: Cashbox[],
    ) => Cashbox[];
    expect(updater(props.cashboxes).map((item) => item.id)).toEqual([
      'cashbox-2',
      'cashbox-1',
    ]);
    expect(updater([cashbox({ id: 'other' })]).map((item) => item.id)).toEqual([
      'other',
    ]);
    expect(onSetDraggedCashboxId).toHaveBeenLastCalledWith(null);

    rerender(
      <AccountingCashboxesView
        {...props}
        draggedCashboxId='cashbox-2'
        onSetCashboxes={onSetCashboxes}
        onSetDraggedCashboxId={onSetDraggedCashboxId}
      />,
    );
    fireEvent.drop(document.querySelectorAll('.finance-cashbox-card')[1]);
    expect(onSetDraggedCashboxId).toHaveBeenLastCalledWith(null);

    rerender(
      <AccountingCashboxesView
        {...props}
        draggedCashboxId={null}
        onSetCashboxes={onSetCashboxes}
        onSetDraggedCashboxId={onSetDraggedCashboxId}
      />,
    );
    fireEvent.drop(document.querySelectorAll('.finance-cashbox-card')[0]);
    expect(onSetDraggedCashboxId).toHaveBeenLastCalledWith(null);

    fireEvent.dragEnd(document.querySelectorAll('.finance-cashbox-card')[0]);
    expect(onSetDraggedCashboxId).toHaveBeenLastCalledWith(null);
  });

  it('ignores drag when the user cannot manage cashboxes', () => {
    const onSetDraggedCashboxId = vi.fn();
    renderView({
      canManageCashboxes: false,
      draggedCashboxId: 'cashbox-1',
      onSetDraggedCashboxId,
    });
    const card = document.querySelectorAll('.finance-cashbox-card')[1];
    fireEvent.dragStart(card);
    fireEvent.dragOver(card);
    fireEvent.drop(card);
    expect(onSetDraggedCashboxId).toHaveBeenCalledWith(null);
  });

  it('blocks withdraw above available balance and confirms large amounts', () => {
    const onCreateTransaction = vi.fn();
    const { rerender, props } = renderView({
      onCreateTransaction,
      transactionForm: transactionForm({
        type: 'withdraw',
        amount: '5000',
        fromCashboxId: 'cashbox-1',
      }),
    });
    openOperation();
    expect(screen.getByText('Amount exceeds the available balance.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save operation' })).toBeDisabled();

    rerender(
      <AccountingCashboxesView
        {...props}
        onCreateTransaction={onCreateTransaction}
        transactionForm={transactionForm({
          type: 'withdraw',
          amount: '900',
          fromCashboxId: 'cashbox-1',
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save operation' }));
    expect(onCreateTransaction).not.toHaveBeenCalled();
    expect(
      screen.getByText('This is a large amount. Click confirm to save.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm operation' }));
    expect(onCreateTransaction).toHaveBeenCalledTimes(1);
  });

  it('confirms large deposits without a source balance check', () => {
    const onCreateTransaction = vi.fn();
    renderView({
      onCreateTransaction,
      transactionForm: transactionForm({
        type: 'deposit',
        amount: '10000',
        toCashboxId: 'cashbox-1',
      }),
    });
    openOperation();
    fireEvent.click(screen.getByRole('button', { name: 'Save operation' }));
    expect(onCreateTransaction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm operation' }));
    expect(onCreateTransaction).toHaveBeenCalledTimes(1);
  });

  it('swaps transfer cashboxes when the same box is selected twice', () => {
    const current = transactionForm({
      type: 'transfer',
      fromCashboxId: 'cashbox-1',
      toCashboxId: 'cashbox-2',
    });
    let next: CreateFinanceTransactionPayload | null = null;
    const onTransactionFormChange = vi.fn(
      (
        updater:
          | CreateFinanceTransactionPayload
          | ((
              current: CreateFinanceTransactionPayload,
            ) => CreateFinanceTransactionPayload),
      ) => {
        next = typeof updater === 'function' ? updater(current) : updater;
      },
    );
    renderView({
      transactionForm: current,
      onTransactionFormChange,
    });
    openOperation();
    fireEvent.change(screen.getByLabelText('From cashbox', { selector: 'select' }), {
      target: { value: 'cashbox-2' },
    });
    expect(next).toEqual({
      ...current,
      fromCashboxId: 'cashbox-2',
      toCashboxId: 'cashbox-1',
    });
    fireEvent.change(screen.getByLabelText('To cashbox', { selector: 'select' }), {
      target: { value: 'cashbox-2' },
    });
    expect(next).toEqual({
      ...current,
      fromCashboxId: 'cashbox-1',
      toCashboxId: 'cashbox-2',
    });
  });

  it('closes the operation modal when not saving', () => {
    renderView();
    openOperation();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button', { name: 'Save operation' })).not.toBeInTheDocument();
  });

  it('keeps the operation modal open while saving', () => {
    renderView({ isSaving: true });
    openOperation();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeInTheDocument();
  });
});
