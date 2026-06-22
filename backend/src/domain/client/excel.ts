import XLSX from 'xlsx';
import { Client, type ClientDocument } from './model';
import { formatClient } from '../../shared/lib/formatters';
import {
  normalizeClientPayload,
  normalizePhone,
  toNonEmptyString,
} from '../../shared/lib/parsers';
import type { ClientPayload } from '../shared/types';

const defaultSheetName = 'Клієнти';
const registrationIdPattern = /^[0-9A-Za-z-]{8,12}$/;
const maxImportedNoteLength = 2000;

type ClientImportRow = Record<string, unknown>;

export type ParsedClientImportRow =
  | {
      status: 'ready';
      rowNumber: number;
      payload: ClientPayload;
      sourcePhone: string;
    }
  | {
      status: 'skipped';
      rowNumber: number;
      reason: 'missingName' | 'missingPhone';
      name: string;
      phone: string;
    };

export type ClientImportReportEntry = {
  rowNumber: number;
  reason: string;
  name?: string;
  phone?: string;
  details?: string;
};

export type ClientImportReport = {
  sheetName: string;
  totalRows: number;
  prepared: number;
  created: number;
  skippedMissingRequired: number;
  skippedExisting: number;
  validationFailed: number;
  skipped: ClientImportReportEntry[];
  validationErrors: ClientImportReportEntry[];
  clients: ReturnType<typeof formatClient>[];
};

const stringifyCell = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
};

const normalizeHeader = (value: string) => value.trim().replace(/\s+/g, ' ');

const getRowValue = (row: ClientImportRow, header: string) => {
  const normalizedHeader = normalizeHeader(header);
  const key = Object.keys(row).find(
    (item) => normalizeHeader(item) === normalizedHeader,
  );

  return key ? row[key] : '';
};

const readString = (row: ClientImportRow, header: string) =>
  stringifyCell(getRowValue(row, header));

export const extractPhones = (rawValue: unknown) => {
  const raw = stringifyCell(rawValue);
  if (!raw) {
    return [];
  }

  const phoneLikeMatches = raw.match(/\+?\d[\d\s().-]{5,}\d/g) ?? [raw];
  const phones = phoneLikeMatches
    .flatMap((part) => part.split(/[;,/\n\r]+/))
    .map(normalizePhone)
    .filter(Boolean);

  return Array.from(new Set(phones));
};

const appendNoteLine = (lines: string[], label: string, value: unknown) => {
  const normalized = stringifyCell(value);
  if (normalized) {
    lines.push(`${normalizeHeader(label)}: ${normalized}`);
  }
};

const appendUniqueNoteLine = (
  lines: string[],
  seenLabels: Set<string>,
  label: string,
  value: unknown,
) => {
  const normalizedLabel = normalizeHeader(label);
  const normalized = stringifyCell(value);
  if (!normalized || seenLabels.has(normalizedLabel)) {
    return;
  }

  seenLabels.add(normalizedLabel);
  lines.push(`${normalizedLabel}: ${normalized}`);
};

const truncateImportedNote = (note: string) => {
  if (note.length <= maxImportedNoteLength) {
    return note;
  }

  const marker = '\n[Imported note truncated]';
  return `${note.slice(0, maxImportedNoteLength - marker.length).trimEnd()}${marker}`;
};

const directFieldHeaders = new Set(
  [
    'ПІБ',
    'Телефони',
    'Ел. адреса',
    'Юр. адреса',
    'Фіз. адреса',
    'Реєстраційні дані 1',
    'Реєстраційні дані 2',
    'Примітка',
  ].map(normalizeHeader),
);

export const parseClientImportRow = (
  row: ClientImportRow,
  rowNumber: number,
): ParsedClientImportRow => {
  const name = readString(row, 'ПІБ');
  const phones = extractPhones(getRowValue(row, 'Телефони'));
  const phone = phones[0] ?? '';

  if (!name) {
    return {
      status: 'skipped',
      rowNumber,
      reason: 'missingName',
      name,
      phone,
    };
  }

  if (!phone) {
    return {
      status: 'skipped',
      rowNumber,
      reason: 'missingPhone',
      name,
      phone,
    };
  }

  const legalAddress = readString(row, 'Юр. адреса');
  const physicalAddress = readString(row, 'Фіз. адреса');
  const address = legalAddress || physicalAddress;
  const registrationData = [
    readString(row, 'Реєстраційні дані 1'),
    readString(row, 'Реєстраційні дані 2'),
  ].filter(Boolean);
  const registrationId =
    registrationData.find((value) => registrationIdPattern.test(value)) ?? '';
  const invalidRegistrationData = registrationData.filter(
    (value) => value !== registrationId,
  );
  const noteLines: string[] = [];
  const seenUnmappedLabels = new Set<string>();

  appendNoteLine(noteLines, 'Source note', getRowValue(row, 'Примітка'));

  if (legalAddress && physicalAddress) {
    appendNoteLine(noteLines, 'Physical address', physicalAddress);
  }

  if (invalidRegistrationData.length > 0) {
    noteLines.push(`Registration data: ${invalidRegistrationData.join('; ')}`);
  }

  Object.entries(row).forEach(([header, value]) => {
    const normalizedHeader = normalizeHeader(header);
    if (directFieldHeaders.has(normalizedHeader)) {
      return;
    }

    appendUniqueNoteLine(noteLines, seenUnmappedLabels, header, value);
  });

  return {
    status: 'ready',
    rowNumber,
    sourcePhone: phone,
    payload: normalizeClientPayload({
      phone,
      phones,
      name,
      email: readString(row, 'Ел. адреса'),
      address,
      registrationId,
      iban: '',
      note: truncateImportedNote(noteLines.join('\n')),
      status: 'new',
    }),
  };
};

export const readClientImportRowsFromBuffer = (buffer: Buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames.includes(defaultSheetName)
    ? defaultSheetName
    : workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error('Workbook does not contain sheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" was not found.`);
  }
  const rows = XLSX.utils.sheet_to_json<ClientImportRow>(sheet, {
    defval: '',
    blankrows: false,
  });

  return { sheetName, rows };
};

const createInitialReport = (
  sheetName: string,
  totalRows: number,
): ClientImportReport => ({
  sheetName,
  totalRows,
  prepared: 0,
  created: 0,
  skippedMissingRequired: 0,
  skippedExisting: 0,
  validationFailed: 0,
  skipped: [],
  validationErrors: [],
  clients: [],
});

const validateClientPayload = async (
  rowNumber: number,
  payload: ClientPayload,
  report: ClientImportReport,
) => {
  const client = new Client(payload);

  try {
    await client.validate();
    return true;
  } catch (error) {
    report.validationFailed += 1;
    report.validationErrors.push({
      rowNumber,
      reason: 'validationFailed',
      name: toNonEmptyString(payload.name),
      phone: toNonEmptyString(payload.phone),
      details: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export const importClientsWorkbook = async (buffer: Buffer) => {
  const { sheetName, rows } = readClientImportRowsFromBuffer(buffer);
  const report = createInitialReport(sheetName, rows.length);
  const parsedRows = rows.map((row, index) => parseClientImportRow(row, index + 2));
  const readyRows = [];

  for (const parsed of parsedRows) {
    if (parsed.status === 'skipped') {
      report.skippedMissingRequired += 1;
      report.skipped.push({
        rowNumber: parsed.rowNumber,
        reason: parsed.reason,
        name: parsed.name,
        phone: parsed.phone,
      });
      continue;
    }

    readyRows.push(parsed);
  }

  const getNormalizedPhones = (payload: ClientPayload) => {
    const normalized = normalizeClientPayload(payload);
    return normalized.phones.length > 0
      ? normalized.phones
      : normalized.phone
        ? [normalized.phone]
        : [];
  };

  const readyPhones = Array.from(
    new Set(readyRows.flatMap((row) => getNormalizedPhones(row.payload))),
  );
  const existing = await Client.find({
    $or: [
      { phone: { $in: readyPhones } },
      { phones: { $in: readyPhones } },
      { phoneIdentities: { $in: readyPhones } },
    ],
  })
    .select({ phone: 1, phones: 1, phoneIdentities: 1 })
    .lean<Array<{ phone: string; phones?: string[]; phoneIdentities?: string[] }>>();
  const existingPhones = new Set<string>();
  for (const c of existing) {
    if (c.phone) existingPhones.add(c.phone);
    (c.phones || []).forEach((p) => p && existingPhones.add(p));
    (c.phoneIdentities || []).forEach((p) => p && existingPhones.add(p));
  }
  const rowsToCreate = [];

  for (const row of readyRows) {
    const phones = getNormalizedPhones(row.payload);
    const primaryPhone = phones[0] ?? '';
    const conflictingPhone = phones.find((phone) => existingPhones.has(phone));
    if (conflictingPhone) {
      report.skippedExisting += 1;
      report.skipped.push({
        rowNumber: row.rowNumber,
        reason: 'skippedExisting',
        name: toNonEmptyString(row.payload.name),
        phone: primaryPhone,
        details: conflictingPhone !== primaryPhone ? conflictingPhone : undefined,
      });
      continue;
    }

    if (await validateClientPayload(row.rowNumber, row.payload, report)) {
      rowsToCreate.push(row);
      phones.forEach((phone) => existingPhones.add(phone));
    }
  }

  report.prepared = rowsToCreate.length;

  if (rowsToCreate.length > 0) {
    const createdClients = await Client.insertMany(
      rowsToCreate.map((row) => row.payload),
      { ordered: false },
    );
    report.created = createdClients.length;
    report.clients = createdClients.map((client) =>
      formatClient(client.toObject<ClientDocument>()),
    );
  }

  return report;
};

export const exportClientsWorkbook = async () => {
  const clients = await Client.find().sort({ createdAt: -1 }).lean<ClientDocument[]>();

  const worksheet = XLSX.utils.json_to_sheet(
    clients.map((client) => {
      const phones = Array.isArray(client.phones) && client.phones.length > 0 ? client.phones : (client.phone ? [client.phone] : []);
      const additional = phones.length > 1 ? phones.slice(1).join('; ') : '';
      return {
        Id: client._id.toString(),
        Phone: phones[0] || client.phone || '',
        'Additional Phones': additional,
        Name: client.name,
        Email: client.email ?? '',
        Address: client.address ?? '',
        'Registration ID': client.registrationId ?? '',
        IBAN: client.iban ?? '',
        Note: client.note ?? '',
        Status: client.status,
        'Created At': client.createdAt.toISOString(),
        'Updated At': client.updatedAt.toISOString(),
      };
    }),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xls',
  });
};
