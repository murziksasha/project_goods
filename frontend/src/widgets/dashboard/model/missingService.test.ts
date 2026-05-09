import { describe, expect, it } from 'vitest';
import {
  buildMissingServicePayload,
  shouldCreateMissingServiceOnSubmit,
} from './missingService';

describe('shouldCreateMissingServiceOnSubmit', () => {
  it('returns true for a missing service without selected id and exact suggestion', () => {
    expect(
      shouldCreateMissingServiceOnSubmit({
        kind: 'service',
        normalizedName: 'Diagnostics',
        suggestionNames: ['Battery replacement'],
      }),
    ).toBe(true);
  });

  it('returns false when service is already selected', () => {
    expect(
      shouldCreateMissingServiceOnSubmit({
        kind: 'service',
        normalizedName: 'Diagnostics',
        selectedServiceId: 'svc-1',
        suggestionNames: [],
      }),
    ).toBe(false);
  });

  it('returns false when exact suggestion exists (case-insensitive)', () => {
    expect(
      shouldCreateMissingServiceOnSubmit({
        kind: 'service',
        normalizedName: 'Diagnostics',
        suggestionNames: [' diagnostics '],
      }),
    ).toBe(false);
  });
});

describe('buildMissingServicePayload', () => {
  it('builds payload with trimmed name and string price', () => {
    expect(buildMissingServicePayload('  Diagnostics  ', 1234)).toMatchObject({
      name: 'Diagnostics',
      price: '1234',
    });
  });
});
