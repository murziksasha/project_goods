import { beforeEach, describe, expect, it } from 'vitest';
import { defaultPrintForms } from '../../../entities/settings/model/printForms';
import type { PrintForm } from '../../../entities/settings/model/types';
import {
  applyPrintFormLocalOverrides,
  getPrintFormOverridesStorageKey,
  getStoredPrintFormOverrides,
  persistPrintFormLayoutOverrides,
  storePrintFormOverrides,
} from './print-form-local-overrides';

const employeeA = 'employee-a';
const employeeB = 'employee-b';

const baseForms: PrintForm[] = [
  {
    ...defaultPrintForms[0],
    pageSize: 'A4',
    orientation: 'portrait',
  },
  {
    ...defaultPrintForms[5],
    pageSize: 'label',
    labelSize: { presetId: '40x25', widthMm: 40, heightMm: 25 },
    orientation: 'landscape',
  },
];

describe('print-form-local-overrides', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores and reads overrides per employee', () => {
    storePrintFormOverrides(employeeA, {
      barcode: {
        contentMargins: { topMm: 1, rightMm: 2, bottomMm: 0.5, leftMm: 3 },
      },
    });
    storePrintFormOverrides(employeeB, {
      barcode: {
        orientation: 'portrait',
      },
    });

    expect(getStoredPrintFormOverrides(employeeA).barcode?.contentMargins).toEqual({
      topMm: 1,
      rightMm: 2,
      bottomMm: 0.5,
      leftMm: 3,
    });
    expect(getStoredPrintFormOverrides(employeeB).barcode?.orientation).toBe(
      'portrait',
    );
    expect(
      window.localStorage.getItem(getPrintFormOverridesStorageKey(employeeA)),
    ).toBeTruthy();
  });

  it('persists layout overrides for all forms on save', () => {
    persistPrintFormLayoutOverrides(employeeA, baseForms);

    expect(getStoredPrintFormOverrides(employeeA).barcode).toMatchObject({
      pageSize: 'label',
      orientation: 'landscape',
    });
  });

  it('merges local layout overrides into server forms', () => {
    persistPrintFormLayoutOverrides(employeeA, [
      ...baseForms.filter((form) => form.id !== 'barcode'),
      {
        ...baseForms[1],
        contentMargins: { topMm: 2, rightMm: 0.5, bottomMm: 1, leftMm: 0.2 },
        pageSize: 'label',
        labelSize: { presetId: '30x20', widthMm: 30, heightMm: 20 },
        orientation: 'portrait',
      },
    ]);

    const merged = applyPrintFormLocalOverrides(baseForms, employeeA);
    const barcode = merged.find((form) => form.id === 'barcode');

    expect(barcode?.contentMargins).toEqual({
      topMm: 2,
      rightMm: 0.5,
      bottomMm: 1,
      leftMm: 0.2,
    });
    expect(barcode?.labelSize).toEqual({
      presetId: '30x20',
      widthMm: 30,
      heightMm: 20,
    });
    expect(barcode?.orientation).toBe('portrait');
  });

  it('returns normalized server forms when employeeId is missing', () => {
    persistPrintFormLayoutOverrides(employeeA, [
      {
        ...baseForms[1],
        orientation: 'portrait',
      },
    ]);

    const merged = applyPrintFormLocalOverrides(baseForms, null);
    expect(merged.find((form) => form.id === 'barcode')?.orientation).not.toBe(
      'portrait',
    );
  });
});