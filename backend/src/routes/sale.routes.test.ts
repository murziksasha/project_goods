import { describe, expect, it } from 'vitest';
import {
  getSaleFavoritePermission,
  isKanbanBoardWorkspacePatch,
  isManualCommentWorkspacePatch,
} from './sale.routes';

const existingSale = {
  kind: 'repair',
  status: 'new',
  paidAmount: 0,
  master: null,
  issuedBy: null,
  productSnapshot: {
    name: 'iPhone 13',
    serialNumber: 'SN-001',
  },
  discount: { mode: 'amount', value: 0 },
  paymentHistory: [],
  lineItems: [],
  timeline: [],
};

describe('isManualCommentWorkspacePatch', () => {
  it('returns true when only timeline changes', () => {
    expect(
      isManualCommentWorkspacePatch(existingSale, {
        kind: 'repair',
        status: 'new',
        paidAmount: 0,
        discount: { mode: 'amount', value: 0 },
        deviceName: 'iPhone 13',
        serialNumber: 'SN-001',
        timeline: [
          {
            id: 'comment-1',
            author: 'Manager',
            message: 'Need client callback.',
            createdAt: '2026-06-09T10:00:00.000Z',
          },
        ],
        paymentHistory: [],
        lineItems: [],
      }),
    ).toBe(true);
  });

  it('treats omitted unchanged workspace fields as comment-only changes', () => {
    expect(
      isManualCommentWorkspacePatch(
        {
          ...existingSale,
          master: 'master-1',
        },
        {
          kind: 'repair',
          status: 'new',
          paidAmount: 0,
          discount: { mode: 'amount', value: 0 },
          timeline: [
            {
              id: 'comment-1',
              author: 'Master',
              message: 'Diagnostics started.',
              createdAt: '2026-06-09T10:00:00.000Z',
            },
          ],
          paymentHistory: [],
          lineItems: [],
        },
      ),
    ).toBe(true);
  });

  it('returns false when workspace data changes together with timeline', () => {
    expect(
      isManualCommentWorkspacePatch(existingSale, {
        kind: 'repair',
        status: 'inRepair',
        paidAmount: 0,
        discount: { mode: 'amount', value: 0 },
        deviceName: 'iPhone 13',
        serialNumber: 'SN-001',
        timeline: [
          {
            id: 'system-1',
            author: 'Manager',
            message: 'Status changed to "In repair".',
            createdAt: '2026-06-09T10:05:00.000Z',
          },
        ],
        paymentHistory: [],
        lineItems: [],
      }),
    ).toBe(false);
  });
});

describe('isKanbanBoardWorkspacePatch', () => {
  const boardPayload = {
    kind: 'repair',
    status: 'inRepair',
    paidAmount: 0,
    discount: { mode: 'amount', value: 0 },
    deviceName: 'iPhone 13',
    serialNumber: 'SN-001',
    timeline: [
      {
        id: 'system-1',
        author: 'Dispatcher',
        message: 'Status changed.',
        createdAt: '2026-06-09T10:05:00.000Z',
      },
    ],
    paymentHistory: [],
    lineItems: [],
  };

  it('returns true when only repair status changes', () => {
    expect(isKanbanBoardWorkspacePatch(existingSale, boardPayload)).toBe(true);
  });

  it('returns true when only the master is assigned', () => {
    expect(
      isKanbanBoardWorkspacePatch(existingSale, {
        ...boardPayload,
        status: 'new',
        masterId: 'master-1',
      }),
    ).toBe(true);
  });

  it('returns false for product sales', () => {
    expect(
      isKanbanBoardWorkspacePatch(
        { ...existingSale, kind: 'sale' },
        { ...boardPayload, kind: 'sale' },
      ),
    ).toBe(false);
  });

  it('returns false when line items change with the status', () => {
    expect(
      isKanbanBoardWorkspacePatch(existingSale, {
        ...boardPayload,
        lineItems: [
          {
            id: 'item-1',
            kind: 'service',
            name: 'Diagnostics',
            price: 250,
            quantity: 1,
          },
        ],
      }),
    ).toBe(false);
  });

  it('returns false when userNote changes with the board patch', () => {
    expect(
      isKanbanBoardWorkspacePatch(existingSale, {
        ...boardPayload,
        userNote: 'Call client',
      }),
    ).toBe(false);
  });

  it('returns true when status changes and stored line items only differ by mongo id shape', () => {
    expect(
      isKanbanBoardWorkspacePatch(
        {
          ...existingSale,
          lineItems: [
            {
              id: 'item-1',
              kind: 'service',
              productId: null,
              catalogProductId: null,
              serviceId: { toString: () => '507f1f77bcf86cd799439011' },
              name: 'Diagnostics',
              price: 250,
              quantity: 1,
              warrantyPeriod: 0,
              serialNumbers: [],
            },
          ],
        },
        {
          ...boardPayload,
          lineItems: [
            {
              id: 'item-1',
              kind: 'service',
              serviceId: '507f1f77bcf86cd799439011',
              name: 'Diagnostics',
              price: 250,
              quantity: 1,
              warrantyPeriod: 0,
              serialNumbers: [],
            },
          ],
        },
      ),
    ).toBe(true);
  });

  it('returns true when a kanban move omits unchanged line items', () => {
    expect(
      isKanbanBoardWorkspacePatch(
        {
          ...existingSale,
          lineItems: [
            {
              id: 'device-placeholder',
              kind: 'service',
              name: 'iPhone 13',
              price: 0,
              quantity: 1,
            },
          ],
        },
        {
          kind: 'repair',
          status: 'inRepair',
          timeline: boardPayload.timeline,
        },
      ),
    ).toBe(true);
  });
});

describe('getSaleFavoritePermission', () => {
  it('requires orders.manage for repair orders', () => {
    expect(getSaleFavoritePermission('repair')).toBe('orders.manage');
  });

  it('requires sales.manage for product sales', () => {
    expect(getSaleFavoritePermission('sale')).toBe('sales.manage');
  });
});
