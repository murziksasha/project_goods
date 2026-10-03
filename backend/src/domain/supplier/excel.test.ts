import XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import { Supplier } from './model';
import {
  exportSuppliersWorkbook,
  extractPhones,
  parseSupplierImportRow,
} from './excel';

describe('supplier Excel import row parsing', () => {
  it('maps an Excel row with English headers to a supplier payload', () => {
    const parsed = parseSupplierImportRow(
      {
        Name: 'Global Tech Parts',
        Phone: '380501112233',
        Status: 'Active',
        'Supplier Order': 'SO-999',
        Note: 'Trusted supplier',
        'Extra Column': 'Extra data',
      },
      2,
    );

    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') return;

    expect(parsed.payload).toMatchObject({
      name: 'Global Tech Parts',
      phone: '+380501112233',
      phones: ['+380501112233'],
      supplierOrder: 'SO-999',
      isActive: true,
    });
    expect(parsed.payload.note).toContain('Source note: Trusted supplier');
    expect(parsed.payload.note).toContain('Extra Column: Extra data');
  });

  it('maps an Excel row with Ukrainian headers to a supplier payload', () => {
    const parsed = parseSupplierImportRow(
      {
        Назва: 'ТОВ Постачальник',
        Телефони: '+380671234567',
        Статус: 'неактивний',
        Замовлення: 'PO-123',
        Примітка: 'Передоплата',
      },
      3,
    );

    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') return;

    expect(parsed.payload).toMatchObject({
      name: 'ТОВ Постачальник',
      phone: '+380671234567',
      phones: ['+380671234567'],
      supplierOrder: 'PO-123',
      isActive: false,
    });
    expect(parsed.payload.note).toContain('Source note: Передоплата');
  });

  it('uses first phone as primary and retains additional phones', () => {
    const parsed = parseSupplierImportRow(
      {
        Name: 'Multi Phone Supplier',
        Phones: '+380671112233, 0502223344 / 0633334455',
      },
      4,
    );

    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') return;

    expect(parsed.payload.phone).toBe('+380671112233');
    expect(parsed.payload.phones).toEqual([
      '+380671112233',
      '+380502223344',
      '+380633334455',
    ]);
  });

  it('skips rows without phone', () => {
    const parsed = parseSupplierImportRow(
      {
        Name: 'No Phone Supplier',
        Phone: '',
      },
      5,
    );

    expect(parsed).toMatchObject({
      status: 'skipped',
      rowNumber: 5,
      reason: 'missingPhone',
      name: 'No Phone Supplier',
    });
  });

  it('skips rows without name or with name shorter than 2 chars', () => {
    const parsed = parseSupplierImportRow(
      {
        Name: 'A',
        Phone: '380671112233',
      },
      6,
    );

    expect(parsed).toMatchObject({
      status: 'skipped',
      rowNumber: 6,
      reason: 'missingName',
      phone: '380671112233',
    });
  });

  it('truncates note if exceeding 500 characters', () => {
    const longText = 'A'.repeat(600);
    const parsed = parseSupplierImportRow(
      {
        Name: 'Long Note Supplier',
        Phone: '380671112233',
        Note: longText,
      },
      7,
    );

    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') return;

    expect(parsed.payload.note.length).toBeLessThanOrEqual(500);
    expect(parsed.payload.note).toContain('[Truncated]');
  });

  it('extracts unique phones correctly', () => {
    expect(
      extractPhones('380671112233, 380671112233\n+38 050 222 33 44'),
    ).toEqual(['380671112233', '+380502223344']);
  });
});

describe('supplier Excel export', () => {
  it('exports all supplier fields to an xls workbook', async () => {
    vi.spyOn(Supplier, 'find').mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            _id: { toString: () => 'supplier-id-1' },
            phone: '+380671112233',
            phones: ['+380671112233', '+380502223344'],
            name: 'Supplier One',
            isActive: true,
            supplierOrder: 'PO-001',
            note: 'Important notes',
            createdAt: new Date('2026-06-08T07:00:00.000Z'),
            updatedAt: new Date('2026-06-08T07:30:00.000Z'),
          },
        ],
      }),
    } as unknown as ReturnType<typeof Supplier.find>);

    const buffer = await exportSuppliersWorkbook();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets.Suppliers,
    );

    expect(rows[0]).toMatchObject({
      Id: 'supplier-id-1',
      Name: 'Supplier One',
      Phone: '+380671112233',
      'Additional Phones': '+380502223344',
      Status: 'active',
      'Supplier Order': 'PO-001',
      Note: 'Important notes',
      'Created At': '2026-06-08T07:00:00.000Z',
      'Updated At': '2026-06-08T07:30:00.000Z',
    });
  });
describe('supplier Excel import workbook', () => {
  it('imports valid rows, skips duplicates and missing fields', async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet([
      {
        Name: 'New Supplier',
        Phone: '380509998877',
        Status: 'Active',
      },
      {
        Name: 'Existing Phone',
        Phone: '380501112233',
      },
      {
        Name: 'Existing Name',
        Phone: '380503334455',
      },
      {
        Name: '',
        Phone: '380504445566',
      },
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });

    vi.spyOn(Supplier, 'find').mockImplementation((query: unknown) => {
      const q = query as Record<string, unknown>;
      if (q.$or) {
        return {
          select: () => ({
            lean: async () => [{ phone: '+380501112233', phones: ['+380501112233'], phoneIdentities: ['380501112233'] }],
          }),
        } as unknown as ReturnType<typeof Supplier.find>;
      }
      return {
        select: () => ({
          lean: async () => [{ name: 'Existing Name' }],
        }),
      } as unknown as ReturnType<typeof Supplier.find>;
    });

    vi.spyOn(Supplier.prototype, 'validate').mockResolvedValue(undefined as never);
    vi.spyOn(Supplier, 'insertMany').mockResolvedValue([
      {
        toObject: () => ({
          _id: { toString: () => 'created-id' },
          name: 'New Supplier',
          phone: '+380509998877',
          phones: ['+380509998877'],
          note: '',
          supplierOrder: '',
          isActive: true,
          createdAt: new Date('2026-06-08T07:00:00.000Z'),
          updatedAt: new Date('2026-06-08T07:00:00.000Z'),
        }),
      },
    ] as never);

    const { importSuppliersWorkbook } = await import('./excel');
    const report = await importSuppliersWorkbook(buffer);

    expect(report.totalRows).toBe(4);
    expect(report.created).toBe(1);
    expect(report.skippedMissingRequired).toBe(1);
    expect(report.skippedExisting).toBe(2);
    expect(report.suppliers).toHaveLength(1);
    expect(report.suppliers[0].name).toBe('New Supplier');
  });
});
});
