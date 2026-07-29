import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../shared/lib/errors';
import {
  buildSalesYearArchiveQuery,
  getSalesHotCutoff,
  listEligibleFinanceArchiveYears,
  listEligibleSalesArchiveYears,
  SALES_HOT_MONTHS,
  createYearlyFinanceDump,
  hashFileSha256,
} from './yearly-dump';

describe('yearly sales dump eligibility', () => {
  it('uses 36-month hot cutoff', () => {
    const now = new Date('2026-07-28T12:00:00.000Z');
    const cutoff = getSalesHotCutoff(now);
    const expected = new Date(now);
    expected.setMonth(expected.getMonth() - SALES_HOT_MONTHS);
    expect(cutoff.toISOString()).toBe(expected.toISOString());
    expect(SALES_HOT_MONTHS).toBe(36);
  });

  it('lists only full years before hot cutoff year', () => {
    // Hot cutoff ~ 2023-07-28 → last full year 2022
    const years = listEligibleSalesArchiveYears(new Date('2026-07-28T12:00:00.000Z'));
    expect(years.at(-1)).toBe(2022);
    expect(years).not.toContain(2023);
    expect(years).not.toContain(2024);
  });

  it('builds terminal-status query for a year', () => {
    const query = buildSalesYearArchiveQuery(2022);
    expect(query.saleDate.$gte.toISOString()).toBe('2022-01-01T00:00:00.000Z');
    expect(query.saleDate.$lt.toISOString()).toBe('2023-01-01T00:00:00.000Z');
    expect(query.status.$in).toContain('paid');
  });
});

describe('yearly finance dump eligibility', () => {
  it('lists years fully before 36-month finance cutoff', () => {
    // cutoff 2023-07-28 → year 2022 ends 2023-01-01 OK; 2023 ends 2024-01-01 not OK
    const years = listEligibleFinanceArchiveYears(new Date('2026-07-28T12:00:00.000Z'));
    expect(years.at(-1)).toBe(2022);
    expect(years).not.toContain(2023);
  });

  it('rejects finance dump purge flag', async () => {
    await expect(
      createYearlyFinanceDump(2020, 'tester', { purge: true }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('offline-only'),
    });
  });
});

describe('hashFileSha256', () => {
  let tmpDir = '';
  let filePath = '';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-hash-'));
    filePath = path.join(tmpDir, 'sample.bin');
    await fs.writeFile(filePath, 'hello-archive');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('hashes file content as sha256 hex', async () => {
    const expected = createHash('sha256').update('hello-archive').digest('hex');
    await expect(hashFileSha256(filePath)).resolves.toBe(expected);
  });
});

describe('HttpError shape for purge gates', () => {
  it('exposes statusCode', () => {
    const error = new HttpError(400, 'blocked');
    expect(error.statusCode).toBe(400);
  });
});

// silence unused vi if tree-shaken differently
void vi;
