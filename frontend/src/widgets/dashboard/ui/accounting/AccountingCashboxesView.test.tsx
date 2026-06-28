import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cashbox, CreateFinanceTransactionPayload } from '../../../../entities/finance/model/types';
import type { CashboxCurrencyRow } from '../../model/accounting';
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

const renderView = (
  patch: Partial<ComponentProps<typeof AccountingCashboxesView>> = {},
) => {
  const rowsByCashbox = new Map<string, CashboxCurrencyRow[]>(
    (patch.cashboxes ?? []).map((item) => [item.id, []]),
  );
  const props: ComponentProps<typeof AccountingCashboxesView> = {
    allowedTransactionCurrencies: ['UAH', 'USD'],
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
    newCashboxName: 'Desk',
    permittedTransactionTypes: ['deposit', 'withdraw', 'transfer'],
    totals: { UAH: 1250, USD: 40, EUR: 0 },
    transactionForm: transactionForm(),
    onCreateCashbox: vi.fn(),
    onCreateTransaction: vi.fn(),
    onNewCashboxNameChange: vi.fn(),
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
    vi.restoreAllMocks();
  });

  it('renders totals, cashbox balances, management controls and action callbacks', () => {
    const { props } = renderView();

    expect(screen.getByText('1,250.00 UAH')).toBeInTheDocument();
    expect(screen.getAllByText('40.00 USD')).toHaveLength(2);
    expect(screen.queryByText('0.00 EUR')).not.toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getAllByText('Withdraw only')).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText('New cashbox'), {
      target: { value: 'Front desk' },
    });
    expect(props.onNewCashboxNameChange).toHaveBeenCalledWith('Front desk');

    fireEvent.click(screen.getByRole('button', { name: 'Add cashbox' }));
    expect(props.onCreateCashbox).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Withdraw' })[0]);
    expect(props.onStartTransaction).toHaveBeenCalledWith(
      'withdraw',
      props.cashboxes[0],
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Deposit' })[0]);
    expect(props.onStartTransaction).toHaveBeenCalledWith(
      'deposit',
      props.cashboxes[0],
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Transfer' })[0]);
    expect(props.onStartTransaction).toHaveBeenCalledWith(
      'transfer',
      props.cashboxes[0],
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Transactions' })[0]);
    expect(props.onOpenCashboxTransactions).toHaveBeenCalledWith(
      props.cashboxes[0],
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save operation' }));
    expect(props.onCreateTransaction).toHaveBeenCalledTimes(1);
  });

  it('scrolls the operation panel into view when starting a cashbox transaction', () => {
    const scrollIntoView = vi.fn();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(
      scrollIntoView,
    );

    const { props } = renderView();
    fireEvent.click(screen.getAllByRole('button', { name: 'Withdraw' })[0]);

    expect(props.onStartTransaction).toHaveBeenCalledWith(
      'withdraw',
      props.cashboxes[0],
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'end',
    });
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

    expect(screen.queryByPlaceholderText('New cashbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deposit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transfer' })).not.toBeInTheDocument();
    expect(screen.queryByText('Operation')).not.toBeInTheDocument();
    expect(screen.getByText('No active currency balances')).toBeInTheDocument();
  });

  it('updates transaction form fields and save state', () => {
    const { props } = renderView({
      allowedTransactionCurrencies: ['USD'],
      transactionForm: transactionForm({
        type: 'withdraw',
        amount: '',
        currency: 'UAH',
        fromCashboxId: 'cashbox-1',
        toCashboxId: '',
      }),
    });

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
    fireEvent.change(screen.getByLabelText('To cashbox', { selector: 'select' }), {
      target: { value: 'cashbox-1' },
    });
    fireEvent.change(screen.getByLabelText('Comment', { selector: 'input' }), {
      target: { value: 'cash movement' },
    });
    expect(props.onTransactionFormChange).toHaveBeenCalledTimes(5);
    type TransactionFormUpdater = (
      current: CreateFinanceTransactionPayload,
    ) => CreateFinanceTransactionPayload;
    const updaters = vi.mocked(props.onTransactionFormChange).mock.calls.map(
      ([updater]) => updater as TransactionFormUpdater,
    );
    const current = transactionForm({ amount: '10', currency: 'UAH' });
    expect(updaters.map((updater: TransactionFormUpdater) => updater(current))).toEqual(
      expect.arrayContaining([
        { ...current, amount: '25.50' },
        { ...current, currency: 'USD' },
        { ...current, fromCashboxId: 'cashbox-1' },
        { ...current, toCashboxId: '' },
      ]),
    );

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

    fireEvent.change(screen.getByLabelText('Comment', { selector: 'input' }), {
      target: { value: 'cash movement' },
    });

    expect(next).toEqual({ ...current, note: 'cash movement' });
  });

  it('disables unavailable operation fields and shows saving/no-currency states', () => {
    renderView({
      allowedTransactionCurrencies: [],
      isSaving: true,
      transactionForm: transactionForm({ type: 'deposit', amount: '50' }),
    });

    expect(screen.getByLabelText('Currency')).toBeDisabled();
    expect(screen.getByText('No available currencies')).toBeInTheDocument();
    expect(screen.getByLabelText('From cashbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('disables target cashbox when withdrawing', () => {
    renderView({
      transactionForm: transactionForm({
        type: 'withdraw',
        fromCashboxId: 'cashbox-1',
        toCashboxId: '',
      }),
    });

    expect(screen.getByLabelText('To cashbox')).toBeDisabled();
  });

  it('limits operation type options to granted permissions', () => {
    const { unmount } = renderView({
      canCreateDeposit: false,
      canCreateTransfer: true,
      canCreateWithdraw: false,
      permittedTransactionTypes: ['transfer'],
      transactionForm: transactionForm({ type: 'transfer' }),
    });

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
});
