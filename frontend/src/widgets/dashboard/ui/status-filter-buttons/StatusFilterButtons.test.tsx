import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusFilterButtons } from './StatusFilterButtons';

describe('StatusFilterButtons', () => {
  const options = [
    { key: 'new', label: 'New' },
    { key: 'approved', label: 'Approved' },
    { key: 'received', label: 'Received' },
  ];

  it('renders all buttons with correct aria-pressed and classes when all are selected', () => {
    const onToggleStatus = vi.fn();
    const onToggleAll = vi.fn();

    render(
      <StatusFilterButtons
        selectedStatuses={['new', 'approved', 'received']}
        options={options}
        allLabel="All"
        onToggleStatus={onToggleStatus}
        onToggleAll={onToggleAll}
      />,
    );

    const allBtn = screen.getByRole('button', { name: 'All' });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
    expect(allBtn.className).toContain('warehouse-mode-button-active');

    const newBtn = screen.getByRole('button', { name: 'New' });
    expect(newBtn).toHaveAttribute('aria-pressed', 'true');
    expect(newBtn.className).toContain('warehouse-mode-button-active');

    fireEvent.click(allBtn);
    expect(onToggleAll).toHaveBeenCalled();

    fireEvent.click(newBtn);
    expect(onToggleStatus).toHaveBeenCalledWith('new');
  });

  it('sets aria-pressed false on All when only some statuses are selected', () => {
    render(
      <StatusFilterButtons
        selectedStatuses={['new']}
        options={options}
        allLabel="All"
        onToggleStatus={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );

    const allBtn = screen.getByRole('button', { name: 'All' });
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');
    expect(allBtn.className).not.toContain('warehouse-mode-button-active');

    const newBtn = screen.getByRole('button', { name: 'New' });
    expect(newBtn).toHaveAttribute('aria-pressed', 'true');
    expect(newBtn.className).toContain('warehouse-mode-button-active');

    const approvedBtn = screen.getByRole('button', { name: 'Approved' });
    expect(approvedBtn).toHaveAttribute('aria-pressed', 'false');
    expect(approvedBtn.className).not.toContain('warehouse-mode-button-active');
  });

  it('sets aria-pressed false on All and all status buttons when none are selected', () => {
    render(
      <StatusFilterButtons
        selectedStatuses={[]}
        options={options}
        allLabel="All"
        onToggleStatus={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );

    const allBtn = screen.getByRole('button', { name: 'All' });
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');

    for (const opt of options) {
      const btn = screen.getByRole('button', { name: opt.label });
      expect(btn).toHaveAttribute('aria-pressed', 'false');
      expect(btn.className).not.toContain('warehouse-mode-button-active');
    }
  });
});
