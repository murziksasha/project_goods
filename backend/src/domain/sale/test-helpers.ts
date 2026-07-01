import { vi } from 'vitest';

export const leanResult = <T>(value: T) => ({
  lean: vi.fn().mockResolvedValue(value),
});

export const leanSelectResult = <T>(value: T) => ({
  select: vi.fn().mockReturnValue(leanResult(value)),
});

const defaultSaleDate = new Date('2026-05-31T10:00:00.000Z');

export const withFormatSaleFields = <T extends Record<string, unknown>>(sale: T) => ({
  saleDate: defaultSaleDate,
  client: '507f1f77bcf86cd799439011',
  clientSnapshot: {
    name: 'Client',
    phone: '+380000000000',
    status: 'new',
  },
  recordNumber: 'r000001',
  createdAt: defaultSaleDate,
  updatedAt: defaultSaleDate,
  ...sale,
});