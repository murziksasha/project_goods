import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sequence } from './model';
import {
  formatProductArticle,
  formatProductSerialNumber,
  formatRecordNumber,
  getNextProductArticleValue,
  getNextProductSerialNumberValue,
  getNextRecordNumber,
  resetRecordNumberSequence,
} from './service';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('sequence formatters', () => {
  it('formats record, serial, and article numbers', () => {
    expect(formatRecordNumber(1)).toBe('r000001');
    expect(formatRecordNumber(42)).toBe('r000042');
    expect(formatProductSerialNumber(7)).toBe('S000007');
    expect(formatProductSerialNumber(0)).toBe('S000001');
    expect(formatProductArticle(3)).toBe('A000003');
  });
});

describe('sequence service', () => {
  it('increments and formats the sale record number', async () => {
    vi.spyOn(Sequence, 'findOneAndUpdate').mockResolvedValue({ value: 12 } as never);

    await expect(getNextRecordNumber()).resolves.toBe('r000012');
    expect(Sequence.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'sale-record-number' },
      { $inc: { value: 1 } },
      { returnDocument: 'after', upsert: true },
    );
  });

  it('resets the sale record sequence', async () => {
    vi.spyOn(Sequence, 'findOneAndUpdate').mockResolvedValue({} as never);

    await resetRecordNumberSequence(0);

    expect(Sequence.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'sale-record-number' },
      { value: 0 },
      { upsert: true },
    );
  });

  it('returns next product serial and article values', async () => {
    vi.spyOn(Sequence, 'findOneAndUpdate')
      .mockResolvedValueOnce({ value: 5 } as never)
      .mockResolvedValueOnce({ value: 9 } as never);

    await expect(getNextProductSerialNumberValue()).resolves.toBe(5);
    await expect(getNextProductArticleValue()).resolves.toBe(9);
  });
});
