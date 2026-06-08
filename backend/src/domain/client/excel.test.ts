import XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';
import { Client } from './model';
import {
  exportClientsWorkbook,
  extractPhones,
  parseClientImportRow,
} from './excel';

describe('client Excel import row parsing', () => {
  it('maps a regular Excel client row to a client payload', () => {
    const parsed = parseClientImportRow(
      {
        ПІБ: 'Ivan Petrenko',
        Телефони: '380671112233',
        'Ел. адреса': 'IVAN@EXAMPLE.COM',
        'Фіз. адреса': 'Kyiv, Main street 1',
        Тип: 'Фіз',
        Примітка: 'Loyal customer',
        'Кількість звернень': 3,
        'Дохід від клієнта': 750,
      },
      2,
    );

    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') return;

    expect(parsed.payload).toMatchObject({
      phone: '380671112233',
      name: 'Ivan Petrenko',
      email: 'IVAN@EXAMPLE.COM',
      address: 'Kyiv, Main street 1',
      registrationId: '',
      status: 'new',
    });
    expect(parsed.payload.note).toContain('Source note: Loyal customer');
    expect(parsed.payload.note).toContain('Тип: Фіз');
    expect(parsed.payload.note).toContain('Кількість звернень: 3');
    expect(parsed.payload.note).toContain('Дохід від клієнта: 750');
  });

  it('uses the first phone and stores additional phones in note', () => {
    const parsed = parseClientImportRow(
      {
        ПІБ: 'Multi Phone',
        Телефони: '380671112233; +38 (050) 222-33-44 / 0633334455',
      },
      3,
    );

    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') return;

    expect(parsed.payload.phone).toBe('380671112233');
    expect(parsed.payload.note).toContain(
      'Additional phones: +380502223344, 0633334455',
    );
  });

  it('skips rows without phone', () => {
    const parsed = parseClientImportRow(
      {
        ПІБ: 'No Phone',
        Телефони: '',
      },
      4,
    );

    expect(parsed).toMatchObject({
      status: 'skipped',
      rowNumber: 4,
      reason: 'missingPhone',
      name: 'No Phone',
    });
  });

  it('skips rows without name', () => {
    const parsed = parseClientImportRow(
      {
        ПІБ: '',
        Телефони: '380671112233',
      },
      5,
    );

    expect(parsed).toMatchObject({
      status: 'skipped',
      rowNumber: 5,
      reason: 'missingName',
      phone: '380671112233',
    });
  });

  it('keeps valid registration ID and moves invalid requisites to note', () => {
    const parsed = parseClientImportRow(
      {
        ПІБ: 'Legal Client',
        Телефони: '380671112233',
        'Юр. адреса': 'Odesa, Business street 10',
        'Реєстраційні дані 1': '12345678',
        'Реєстраційні дані 2': 'invalid legal details with spaces',
      },
      6,
    );

    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') return;

    expect(parsed.payload.registrationId).toBe('12345678');
    expect(parsed.payload.address).toBe('Odesa, Business street 10');
    expect(parsed.payload.note).toContain(
      'Registration data: invalid legal details with spaces',
    );
  });

  it('moves unknown columns to note', () => {
    const parsed = parseClientImportRow(
      {
        ПІБ: 'Unknown Columns',
        Телефони: '380671112233',
        'Custom field': 'custom value',
      },
      7,
    );

    expect(parsed.status).toBe('ready');
    if (parsed.status !== 'ready') return;

    expect(parsed.payload.note).toContain('Custom field: custom value');
  });

  it('extracts unique phones from mixed separators', () => {
    expect(extractPhones('380671112233, 380671112233\n+38 050 222 33 44')).toEqual([
      '380671112233',
      '+380502223344',
    ]);
  });
});

describe('client Excel export', () => {
  it('exports all client fields to an xls workbook', async () => {
    vi.spyOn(Client, 'find').mockReturnValue({
      sort: () => ({
        lean: async () => [
          {
            _id: { toString: () => 'client-id' },
            phone: '380671112233',
            name: 'Ivan Petrenko',
            email: 'ivan@example.com',
            address: 'Kyiv',
            registrationId: '12345678',
            iban: 'UA123456789012345678901234567',
            note: 'Note',
            status: 'new',
            createdAt: new Date('2026-06-08T07:00:00.000Z'),
            updatedAt: new Date('2026-06-08T07:30:00.000Z'),
          },
        ],
      }),
    } as unknown as ReturnType<typeof Client.find>);

    const buffer = await exportClientsWorkbook();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets.Clients,
    );

    expect(rows[0]).toMatchObject({
      Id: 'client-id',
      Phone: '380671112233',
      Name: 'Ivan Petrenko',
      Email: 'ivan@example.com',
      Address: 'Kyiv',
      'Registration ID': '12345678',
      IBAN: 'UA123456789012345678901234567',
      Note: 'Note',
      Status: 'new',
      'Created At': '2026-06-08T07:00:00.000Z',
      'Updated At': '2026-06-08T07:30:00.000Z',
    });
  });
});
