import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Cashbox } from '../../../../entities/finance';
import i18n from '../../../../shared/i18n/config';
import { EmployeeCashboxMultiselect } from './EmployeeCashboxMultiselect';

afterEach(() => {
  cleanup();
});

const sampleCashboxes: Cashbox[] = [
  {
    id: 'cb-1',
    name: 'Main Cashbox',
    balances: { UAH: 1000, USD: 0, EUR: 0 },
    enabledCurrencies: { UAH: true, USD: false, EUR: false },
    isDefault: true,
    isNonCash: false,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'cb-2',
    name: 'Terminal Card POS',
    balances: { UAH: 5000, USD: 0, EUR: 0 },
    enabledCurrencies: { UAH: true, USD: false, EUR: false },
    isDefault: false,
    isNonCash: true,
    isArchived: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'cb-archived',
    name: 'Old Closed Cashbox',
    balances: { UAH: 0, USD: 0, EUR: 0 },
    enabledCurrencies: { UAH: true, USD: false, EUR: false },
    isDefault: false,
    isNonCash: false,
    isArchived: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-06-01',
  },
];

const renderComponent = (
  props: Partial<Parameters<typeof EmployeeCashboxMultiselect>[0]> = {},
) => {
  const onChange = vi.fn();
  const defaultProps = {
    cashboxes: sampleCashboxes,
    selectedCashboxIds: [],
    onChange,
    disabled: false,
    isOwner: false,
    canPay: true,
  };

  const rendered = render(
    <I18nextProvider i18n={i18n}>
      <EmployeeCashboxMultiselect {...defaultProps} {...props} />
    </I18nextProvider>,
  );

  const getTrigger = () =>
    screen.getByRole('button', { name: /allowed cashboxes/i });

  return { ...rendered, onChange, getTrigger };
};

describe('EmployeeCashboxMultiselect', () => {
  it('renders trigger with placeholder when no cashboxes are selected', () => {
    const { getTrigger } = renderComponent({ selectedCashboxIds: [] });
    expect(getTrigger()).toHaveTextContent('Select cashboxes...');
  });

  it('renders selected count in trigger when cashboxes are selected', () => {
    const { getTrigger } = renderComponent({ selectedCashboxIds: ['cb-1'] });
    expect(getTrigger()).toHaveTextContent('1 cashboxes selected');
  });

  it('opens dropdown on click and displays active cashboxes without archived ones', () => {
    const { getTrigger } = renderComponent();
    fireEvent.click(getTrigger());

    expect(screen.getByText('Main Cashbox')).toBeInTheDocument();
    expect(screen.getByText('Terminal Card POS')).toBeInTheDocument();
    expect(screen.queryByText('Old Closed Cashbox')).not.toBeInTheDocument();
  });

  it('filters cashboxes by search query', () => {
    const { getTrigger } = renderComponent();
    fireEvent.click(getTrigger());

    const searchInput = screen.getByPlaceholderText('Search cashboxes...');
    fireEvent.change(searchInput, { target: { value: 'Terminal' } });

    expect(screen.queryByText('Main Cashbox')).not.toBeInTheDocument();
    expect(screen.getByText('Terminal Card POS')).toBeInTheDocument();
  });

  it('toggles cashbox selection calling onChange', () => {
    const { onChange, getTrigger } = renderComponent({ selectedCashboxIds: ['cb-1'] });
    fireEvent.click(getTrigger());

    const terminalCheckbox = screen.getByRole('option', { name: /terminal card pos/i });
    fireEvent.click(terminalCheckbox);

    expect(onChange).toHaveBeenCalledWith(['cb-1', 'cb-2']);
  });

  it('removes cashbox selection when checked option is clicked', () => {
    const { onChange, getTrigger } = renderComponent({ selectedCashboxIds: ['cb-1', 'cb-2'] });
    fireEvent.click(getTrigger());

    const mainCheckbox = screen.getByRole('option', { name: /main cashbox/i });
    fireEvent.click(mainCheckbox);

    expect(onChange).toHaveBeenCalledWith(['cb-2']);
  });

  it('selects all active cashboxes on Select all click', () => {
    const { onChange, getTrigger } = renderComponent({ selectedCashboxIds: ['cb-1'] });
    fireEvent.click(getTrigger());

    const selectAllBtn = screen.getByText('Select all');
    fireEvent.click(selectAllBtn);

    expect(onChange).toHaveBeenCalledWith(['cb-1', 'cb-2']);
  });

  it('clears all cashbox selections on Deselect all click', () => {
    const { onChange, getTrigger } = renderComponent({ selectedCashboxIds: ['cb-1'] });
    fireEvent.click(getTrigger());

    const deselectAllBtn = screen.getByText('Deselect all');
    fireEvent.click(deselectAllBtn);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('disables trigger and displays owner notice when isOwner is true', () => {
    const { getTrigger } = renderComponent({ isOwner: true });

    expect(getTrigger()).toBeDisabled();
    expect(
      screen.getByText('Owners have full access to all cashboxes.'),
    ).toBeInTheDocument();
  });

  it('disables trigger and displays permission required notice when canPay is false', () => {
    const { getTrigger } = renderComponent({ canPay: false });

    expect(getTrigger()).toBeDisabled();
    expect(
      screen.getByText("Enable 'Pay orders' or 'Pay sales' to configure cashboxes."),
    ).toBeInTheDocument();
  });
});

