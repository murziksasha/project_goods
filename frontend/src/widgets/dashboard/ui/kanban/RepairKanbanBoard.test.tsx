import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Sale } from '../../../../entities/sale/model/types';
import { RepairKanbanBoard } from './RepairKanbanBoard';

const sale = {
  id: 'sale-1',
  recordNumber: 'r0001',
  status: 'new',
  kind: 'repair',
  client: { name: 'Client A' },
  product: { name: 'Saeco' },
  lineItems: [],
  master: null,
} as unknown as Sale;

describe('RepairKanbanBoard', () => {
  it('renders pipeline columns and a card without sortable shells', () => {
    const { container } = render(
      <RepairKanbanBoard
        sales={[sale]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
      />,
    );

    expect(screen.getByTestId('repair-kanban-board')).toBeInTheDocument();
    expect(screen.getByText('#r0001')).toBeInTheDocument();
    expect(screen.getByLabelText(/new|нове/i)).toBeInTheDocument();
    expect(container.querySelector('.repair-kanban-card-shell')).toBeTruthy();
    expect(container.querySelector('.repair-kanban-drop-placeholder')).toBeNull();
    expect(container.querySelector('.repair-kanban-card-device')).toBeTruthy();
    expect(container.querySelector('.repair-kanban-card-total')).toBeNull();
  });

  it('shows the order total when the sale has line items', () => {
    const { container } = render(
      <RepairKanbanBoard
        sales={[
          {
            ...sale,
            lineItems: [
              {
                id: 'item-1',
                kind: 'service',
                name: 'Diagnostics',
                price: 250,
                quantity: 1,
                warrantyPeriod: 0,
              },
            ],
            salePrice: 0,
            quantity: 1,
          } as Sale,
        ]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
      />,
    );

    expect(container.querySelector('.repair-kanban-card-total')).toBeTruthy();
  });

  it('shows the client phone next to the order number without +38', () => {
    render(
      <RepairKanbanBoard
        sales={[
          {
            ...sale,
            client: {
              name: 'Client A',
              phone: '+380990569080',
            },
          } as Sale,
        ]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
      />,
    );

    const phone = screen.getByText('099 056 90 80');
    expect(phone.tagName).toBe('STRONG');
    expect(phone).toHaveClass('repair-kanban-card-phone');
    expect(screen.getByText('#r0001')).toBeInTheDocument();
  });

  it('hides the phone when the client number is empty', () => {
    const { container } = render(
      <RepairKanbanBoard
        sales={[sale]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
      />,
    );

    expect(container.querySelector('.repair-kanban-card-phone')).toBeNull();
  });

  it('opens a move sheet with pipeline statuses', () => {
    const onStatusChange = vi.fn();
    render(
      <RepairKanbanBoard
        sales={[sale]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={onStatusChange}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Move$/i }));
    const dialog = screen.getByRole('dialog', { name: /Move order r0001/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /In repair/i }));
    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sale-1' }),
      'inRepair',
    );
  });

  it('renders the column navigator for jump/drop targets', () => {
    render(
      <RepairKanbanBoard
        sales={[sale]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('navigation', { name: /Kanban columns/i }),
    ).toBeInTheDocument();
  });
});
