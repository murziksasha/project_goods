import { describe, expect, it } from 'vitest';
import { assertNotStale, HttpError } from './errors';

describe('assertNotStale', () => {
  it('does nothing when expectedUpdatedAt is not provided', () => {
    expect(() => assertNotStale(undefined, new Date('2026-01-01'), 'Product')).not.toThrow();
  });

  it('throws 400 for invalid expectedUpdatedAt', () => {
    expect(() => assertNotStale('not-a-date', new Date('2026-01-01'), 'Product')).toThrowError(
      new HttpError(400, 'Invalid expectedUpdatedAt value.'),
    );
  });

  it('throws 409 when optimistic lock check fails', () => {
    expect(() =>
      assertNotStale('2026-01-01T00:00:00.000Z', new Date('2026-01-01T00:00:01.000Z'), 'Product'),
    ).toThrowError(
      new HttpError(409, 'Product was modified by another user. Reload and try again.'),
    );
  });
});
