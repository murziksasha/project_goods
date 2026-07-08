import { describe, expect, it } from 'vitest';
import { shouldAdvanceAfterSerialBulkInput } from './serial-input-auto-advance';

describe('shouldAdvanceAfterSerialBulkInput', () => {
  it('does not advance for single-character typing', () => {
    expect(shouldAdvanceAfterSerialBulkInput('', 'S')).toBe(false);
    expect(shouldAdvanceAfterSerialBulkInput('S00', 'S000')).toBe(false);
  });

  it('advances for paste-like bulk insert', () => {
    expect(shouldAdvanceAfterSerialBulkInput('', 'S000001')).toBe(true);
    expect(shouldAdvanceAfterSerialBulkInput('OLD', 'NEW-SERIAL')).toBe(true);
  });

  it('does not advance for empty values', () => {
    expect(shouldAdvanceAfterSerialBulkInput('', '')).toBe(false);
    expect(shouldAdvanceAfterSerialBulkInput('S000001', '   ')).toBe(false);
  });
});