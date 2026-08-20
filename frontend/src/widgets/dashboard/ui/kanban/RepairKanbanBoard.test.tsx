import { render, screen } from '@testing-library/react';
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
  });
});
