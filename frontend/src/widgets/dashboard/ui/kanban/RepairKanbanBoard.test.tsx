import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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

    expect(
      screen.getByTestId('repair-kanban-board'),
    ).toBeInTheDocument();
    expect(screen.getByText('#r0001')).toBeInTheDocument();
    expect(screen.getByLabelText(/new|нове/i)).toBeInTheDocument();
    expect(
      container.querySelector('.repair-kanban-card-shell'),
    ).toBeTruthy();
    expect(
      container.querySelector('.repair-kanban-drop-placeholder'),
    ).toBeNull();
    expect(
      container.querySelector('.repair-kanban-card-device'),
    ).toBeTruthy();
    expect(
      container.querySelector('.repair-kanban-card-total'),
    ).toBeNull();
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

    expect(
      container.querySelector('.repair-kanban-card-total'),
    ).toBeTruthy();
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

    expect(
      container.querySelector('.repair-kanban-card-phone'),
    ).toBeNull();
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
    const dialog = screen.getByRole('dialog', {
      name: /Move order r0001/i,
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: /In repair/i }),
    );
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

  it('shows Up button only for non-first cards when onRankChange is provided', () => {
    const sale2 = {
      ...sale,
      id: 'sale-2',
      recordNumber: 'r0002',
      kanbanRank: 2000,
      saleDate: '2026-01-02T00:00:00.000Z',
    } as unknown as Sale;
    const sale1ranked = {
      ...sale,
      kanbanRank: 1000,
      saleDate: '2026-01-01T00:00:00.000Z',
    } as unknown as Sale;

    render(
      <RepairKanbanBoard
        sales={[sale1ranked, sale2]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
        onRankChange={vi.fn()}
      />,
    );

    const upBtns = screen.getAllByRole('button', {
      name: /move up/i,
    });
    const downBtns = screen.getAllByRole('button', {
      name: /move down/i,
    });
    // Only card at rank 2000 has Up; only card at rank 1000 has Down
    expect(upBtns).toHaveLength(1);
    expect(downBtns).toHaveLength(1);
  });

  it('calls onRankChange with saleId and new rank when Up is clicked', () => {
    const onRankChange = vi.fn();
    const sale2 = {
      ...sale,
      id: 'sale-2',
      recordNumber: 'r0002',
      kanbanRank: 2000,
      saleDate: '2026-01-02T00:00:00.000Z',
    } as unknown as Sale;
    const sale1ranked = {
      ...sale,
      kanbanRank: 1000,
      saleDate: '2026-01-01T00:00:00.000Z',
    } as unknown as Sale;

    render(
      <RepairKanbanBoard
        sales={[sale1ranked, sale2]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
        onRankChange={onRankChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /move up/i }));
    expect(onRankChange).toHaveBeenCalledOnce();
    const updates: Array<{ saleId: string; kanbanRank: number }> =
      onRankChange.mock.calls[0][0];
    const movedEntry = updates.find((u) => u.saleId === 'sale-2');
    expect(movedEntry).toBeDefined();
    expect(movedEntry!.kanbanRank).toBe(1000);
  });

  it('does not show Up/Down buttons when onRankChange is absent', () => {
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
      screen.queryByRole('button', { name: /move up/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /move down/i }),
    ).not.toBeInTheDocument();
  });

  it('optimistically swaps card positions when Up button is clicked', async () => {
    const onRankChange = vi.fn().mockResolvedValue(undefined);
    const sale2 = {
      ...sale,
      id: 'sale-2',
      recordNumber: 'r0002',
      kanbanRank: 2000,
      saleDate: '2026-01-02T00:00:00.000Z',
    } as unknown as Sale;
    const sale1ranked = {
      ...sale,
      id: 'sale-1',
      recordNumber: 'r0001',
      kanbanRank: 1000,
      saleDate: '2026-01-01T00:00:00.000Z',
    } as unknown as Sale;

    const { container } = render(
      <RepairKanbanBoard
        sales={[sale1ranked, sale2]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
        onRankChange={onRankChange}
      />,
    );

    // Initially, sale1 (#r0001) is first, sale2 (#r0002) is second
    const numbersBefore = container.querySelectorAll(
      '.repair-kanban-card-number',
    );
    expect(numbersBefore[0].textContent).toBe('#r0001');
    expect(numbersBefore[1].textContent).toBe('#r0002');

    // Click Up on sale-2
    fireEvent.click(screen.getByRole('button', { name: /move up/i }));

    // Optimistically reordered: sale2 (#r0002) is now first!
    const numbersAfter = container.querySelectorAll(
      '.repair-kanban-card-number',
    );
    expect(numbersAfter[0].textContent).toBe('#r0002');
    expect(numbersAfter[1].textContent).toBe('#r0001');
  });

  it('reverts optimistic position when onRankChange fails', async () => {
    const onRankChange = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));
    const sale2 = {
      ...sale,
      id: 'sale-2',
      recordNumber: 'r0002',
      kanbanRank: 2000,
      saleDate: '2026-01-02T00:00:00.000Z',
    } as unknown as Sale;
    const sale1ranked = {
      ...sale,
      id: 'sale-1',
      recordNumber: 'r0001',
      kanbanRank: 1000,
      saleDate: '2026-01-01T00:00:00.000Z',
    } as unknown as Sale;

    const { container } = render(
      <RepairKanbanBoard
        sales={[sale1ranked, sale2]}
        employees={[]}
        canUpdateStatus
        canUpdateMaster={false}
        onStatusChange={vi.fn()}
        onMasterChange={vi.fn()}
        onOpenSale={vi.fn()}
        onRankChange={onRankChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /move up/i }));

    // Wait for the rejected promise to revert state
    await vi.waitFor(() => {
      const numbers = container.querySelectorAll(
        '.repair-kanban-card-number',
      );
      expect(numbers[0].textContent).toBe('#r0001');
      expect(numbers[1].textContent).toBe('#r0002');
    });
  });
});
