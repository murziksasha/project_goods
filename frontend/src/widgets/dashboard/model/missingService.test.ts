import { describe, expect, it, vi } from 'vitest';
import {
  buildMissingServicePayload,
  findExactServiceSuggestion,
  hasDuplicateServiceName,
  resolveOrCreateServiceCatalogItem,
  shouldCreateMissingServiceOnSubmit,
} from './missingService';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';

const catalogItem = (
  patch: Partial<ServiceCatalogItem> = {},
): ServiceCatalogItem => ({
  id: 'svc-1',
  name: 'Ремонт',
  price: 100,
  salePriceOptions: [],
  note: '',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('findExactServiceSuggestion', () => {
  it('matches catalog names case-insensitively', () => {
    expect(
      findExactServiceSuggestion(
        [{ id: '1', name: 'Ремонт' }],
        'ремонт',
      )?.id,
    ).toBe('1');
  });

  it('collapses extra whitespace before comparing', () => {
    expect(
      findExactServiceSuggestion(
        [{ id: '1', name: 'Ремонт  плати' }],
        '  ремонт плати  ',
      )?.id,
    ).toBe('1');
  });
});

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

describe('hasDuplicateServiceName', () => {
  it('treats inactive rows and collapsed whitespace as the same name', () => {
    expect(
      hasDuplicateServiceName(
        [catalogItem({ id: '16', name: 'Ремонт', isActive: false })],
        '  ремонт  ',
      ),
    ).toBe(true);
  });

  it('allows renaming the current row to its own name', () => {
    expect(
      hasDuplicateServiceName(
        [catalogItem({ id: '16', name: 'Ремонт' })],
        'Ремонт',
        '16',
      ),
    ).toBe(false);
  });
});

describe('resolveOrCreateServiceCatalogItem', () => {
  it('reuses an existing catalog row instead of creating', async () => {
    const existing = catalogItem();
    const create = vi.fn();

    const result = await resolveOrCreateServiceCatalogItem({
      name: 'ремонт',
      lookup: async () => [existing],
      create,
    });

    expect(result).toEqual(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates when lookup has no exact name', async () => {
    const created = catalogItem({ id: 'svc-new', name: 'Diagnostics' });
    const create = vi.fn(async () => created);

    const result = await resolveOrCreateServiceCatalogItem({
      name: 'Diagnostics',
      lookup: async () => [],
      create,
    });

    expect(result).toEqual(created);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('reuses the catalog row when create fails because the name exists', async () => {
    const existing = catalogItem();
    const lookup = vi
      .fn(async (_query: string): Promise<ServiceCatalogItem[]> => [])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([existing]);
    const create = vi.fn(async () => {
      throw new Error('Service with this name already exists.');
    });

    const result = await resolveOrCreateServiceCatalogItem({
      name: 'Ремонт',
      lookup,
      create,
    });

    expect(result).toEqual(existing);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
