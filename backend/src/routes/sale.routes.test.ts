import { describe, expect, it } from 'vitest';
import { isManualCommentWorkspacePatch } from './sale.routes';

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
