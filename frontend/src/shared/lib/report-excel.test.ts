import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildReportWorkbook } from './report-excel';

describe('buildReportWorkbook', () => {
  it('appends a Metadata & Definitions sheet with filters, definitions, timestamp, and coverage warnings', () => {
    const workbook = buildReportWorkbook({
      title: 'Warehouse Inventory & Forecast',
      generatedAt: '2026-11-11T10:00:00.000Z',
      timeZone: 'Europe/Kiev',
      activeFilters: [
        { filter: 'Location', value: 'Main shelf' },
        { filter: 'Aging bucket', value: '90+' },
      ],
      definitions: [
        {
          metric: 'Available units',
          definition: 'Current quantity minus manual and open-order reserved units.',
        },
      ],
      warnings: ['2 item(s) lack purchase date and are grouped under unknown age.'],
      sheets: [
        {
          name: 'Stock Items: Main/Shelf?',
          rows: [
            { SKU: 'SSD-512', Quantity: 12, Available: 10 },
          ],
        },
      ],
    });

    expect(workbook.SheetNames).toContain('Metadata & Definitions');
    const sanitizedDataSheetName = workbook.SheetNames.find(
      (name) => name !== 'Metadata & Definitions',
    );
    expect(sanitizedDataSheetName).toBeDefined();
    expect(sanitizedDataSheetName).not.toMatch(/[\\/?*[\]:]/);

    const dataRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[sanitizedDataSheetName!],
    );
    expect(dataRows).toEqual([{ SKU: 'SSD-512', Quantity: 12, Available: 10 }]);

    const metaRows = XLSX.utils.sheet_to_json<{
      Section: string;
      Key: string;
      Value: string;
    }>(workbook.Sheets['Metadata & Definitions']);

    expect(metaRows).toEqual(
      expect.arrayContaining([
        { Section: 'Report', Key: 'Title', Value: 'Warehouse Inventory & Forecast' },
        { Section: 'Report', Key: 'Generated At (UTC)', Value: '2026-11-11T10:00:00.000Z' },
        { Section: 'Report', Key: 'Business Time Zone', Value: 'Europe/Kiev' },
        { Section: 'Active Filter', Key: 'Location', Value: 'Main shelf' },
        {
          Section: 'Metric Definition',
          Key: 'Available units',
          Value: 'Current quantity minus manual and open-order reserved units.',
        },
        {
          Section: 'Coverage Warning',
          Key: 'Warning 1',
          Value: '2 item(s) lack purchase date and are grouped under unknown age.',
        },
      ]),
    );
  });

  it('writes default empty and no-warning placeholders when sheets or warnings are empty', () => {
    const workbook = buildReportWorkbook({
      title: 'Cashboxes Information',
      activeFilters: [{ filter: 'Currency', value: '' }],
      definitions: [],
      warnings: [],
      sheets: [
        {
          name: 'Transactions',
          rows: [],
        },
      ],
    });

    const txRows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets.Transactions,
    );
    expect(txRows).toEqual([{ Status: 'No matching records for active filters' }]);

    const metaRows = XLSX.utils.sheet_to_json<{
      Section: string;
      Key: string;
      Value: string;
    }>(workbook.Sheets['Metadata & Definitions']);
    expect(metaRows).toEqual(
      expect.arrayContaining([
        { Section: 'Active Filter', Key: 'Currency', Value: 'All' },
        {
          Section: 'Coverage Warning',
          Key: 'Status',
          Value: 'No data coverage warnings for this selection.',
        },
      ]),
    );
  });
});
