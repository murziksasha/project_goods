import XLSX from 'xlsx';
import { Supplier, type SupplierDocument } from './model';
import { formatSupplier } from '../../shared/lib/formatters';
import {
  normalizePhone,
  normalizeSupplierPayload,
  toNonEmptyString,
} from '../../shared/lib/parsers';
import { HttpError } from '../../shared/lib/errors';

const defaultSheetNames = ['Постачальники', 'Suppliers'];
const maxImportedNoteLength = 500;

type SupplierImportRow = Record<string, unknown>;

export type ParsedSupplierImportRow =
  | {
      status: 'ready';
      rowNumber: number;
      payload: ReturnType<typeof normalizeSupplierPayload>;
      sourcePhone: string;
    }
  | {
      status: 'skipped';
      rowNumber: number;
      reason: 'missingName' | 'missingPhone';
      name: string;
      phone: string;
    };

export type SupplierImportReportEntry = {
  rowNumber: number;
  reason: string;
  name?: string;
  phone?: string;
  details?: string;
};

export type SupplierImportReport = {
  sheetName: string;
  totalRows: number;
  prepared: number;
  created: number;
  skippedMissingRequired: number;
  skippedExisting: number;
  validationFailed: number;
  skipped: SupplierImportReportEntry[];
  validationErrors: SupplierImportReportEntry[];
  suppliers: ReturnType<typeof formatSupplier>[];
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

const getRowValue = (row: SupplierImportRow, header: string) => {
  const normalizedHeader = normalizeHeader(header);
  const key = Object.keys(row).find(
    (item) => normalizeHeader(item) === normalizedHeader,
  );

  return key ? row[key] : '';
};

const getFirstRowValue = (row: SupplierImportRow, headers: string[]) => {
  for (const header of headers) {
    const value = getRowValue(row, header);
    if (value !== '' && value !== undefined && value !== null) {
      return value;
    }
  }
  return '';
};

const readFirstString = (row: SupplierImportRow, headers: string[]) =>
  stringifyCell(getFirstRowValue(row, headers));

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

  const marker = '\n[Truncated]';
  return `${note.slice(0, maxImportedNoteLength - marker.length).trimEnd()}${marker}`;
};

const directFieldHeaders = new Set(
  [
    'ПІБ',
    'Name',
    'Назва',
    'Постачальник',
    'Имя',
    'Наименование',
    'Телефони',
    'Phones',
    'Phone',
    'Телефон',
    'Additional Phones',
    'Номер',
    'Примітка',
    'Note',
    'Примечание',
    'Коментар',
    'Comment',
    'Замовлення',
    'Supplier Order',
    'Замовлення постачальнику',
    'Заказ',
    'Заказ поставщику',
    'Status',
    'Статус',
    'Active',
    'Активний',
    'Активен',
    'Id',
    'ID',
    'Created At',
    'Updated At',
    'Створено',
    'Оновлено',
  ].map(normalizeHeader),
);

const parseIsActive = (rawValue: unknown): boolean => {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return true;
  }
  const str = String(rawValue).trim().toLowerCase();
  if (
    str === 'inactive' ||
    str === 'false' ||
    str === '0' ||
    str === 'неактивний' ||
    str === 'неактивен' ||
    str === 'off'
  ) {
    return false;
  }
  return true;
};

export const parseSupplierImportRow = (
  row: SupplierImportRow,
  rowNumber: number,
): ParsedSupplierImportRow => {
  const name = readFirstString(row, [
    'Name',
    'ПІБ',
    'Назва',
    'Постачальник',
    'Имя',
    'Наименование',
  ]);
  const phonesRaw = getFirstRowValue(row, [
    'Phone',
    'Phones',
    'Телефони',
    'Телефон',
    'Additional Phones',
    'Номер',
  ]);
  const phones = extractPhones(phonesRaw);
  const phone = phones[0] ?? '';

  if (!name || name.length < 2) {
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

  const supplierOrder = readFirstString(row, [
    'Supplier Order',
    'Замовлення',
    'Замовлення постачальнику',
    'Заказ',
    'Заказ поставщику',
  ]);
  const statusRaw = getFirstRowValue(row, [
    'Status',
    'Статус',
    'Active',
    'Активний',
    'Активен',
  ]);
  const isActive = parseIsActive(statusRaw);

  const noteLines: string[] = [];
  const seenUnmappedLabels = new Set<string>();

  const primaryNote = readFirstString(row, [
    'Note',
    'Примітка',
    'Примечание',
    'Коментар',
    'Comment',
  ]);
  if (primaryNote) {
    appendNoteLine(noteLines, 'Source note', primaryNote);
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
    payload: normalizeSupplierPayload({
      phone,
      phones,
      name,
      supplierOrder,
      isActive,
      note: truncateImportedNote(noteLines.join('\n')),
    }),
  };
};

export const readSupplierImportRowsFromBuffer = (buffer: Buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName =
    defaultSheetNames.find((name) => workbook.SheetNames.includes(name)) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new HttpError(400, 'Workbook does not contain sheets.');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new HttpError(404, `Sheet "${sheetName}" was not found.`);
  }
  const rows = XLSX.utils.sheet_to_json<SupplierImportRow>(sheet, {
    defval: '',
    blankrows: false,
  });

  return { sheetName, rows };
};

const createInitialReport = (
  sheetName: string,
  totalRows: number,
): SupplierImportReport => ({
  sheetName,
  totalRows,
  prepared: 0,
  created: 0,
  skippedMissingRequired: 0,
  skippedExisting: 0,
  validationFailed: 0,
  skipped: [],
  validationErrors: [],
  suppliers: [],
});

const validateSupplierPayload = async (
  rowNumber: number,
  payload: ReturnType<typeof normalizeSupplierPayload>,
  report: SupplierImportReport,
) => {
  const supplier = new Supplier(payload);

  try {
    await supplier.validate();
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

export const importSuppliersWorkbook = async (buffer: Buffer) => {
  const { sheetName, rows } = readSupplierImportRowsFromBuffer(buffer);
  const report = createInitialReport(sheetName, rows.length);
  const parsedRows = rows.map((row, index) =>
    parseSupplierImportRow(row, index + 2),
  );
  const readyRows: Array<Extract<ParsedSupplierImportRow, { status: 'ready' }>> =
    [];

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

  const getNormalizedPhones = (
    payload: ReturnType<typeof normalizeSupplierPayload>,
  ) => {
    return payload.phones.length > 0
      ? payload.phones
      : payload.phone
        ? [payload.phone]
        : [];
  };

  const readyPhones = Array.from(
    new Set(readyRows.flatMap((row) => getNormalizedPhones(row.payload))),
  );
  const readyNames = Array.from(
    new Set(
      readyRows.map((row) => row.payload.name.trim().toLowerCase()),
    ),
  );

  const [existingByPhone, existingByName] = await Promise.all([
    Supplier.find({
      $or: [
        { phone: { $in: readyPhones } },
        { phones: { $in: readyPhones } },
        { phoneIdentities: { $in: readyPhones } },
      ],
    })
      .select({ phone: 1, phones: 1, phoneIdentities: 1 })
      .lean<Array<{ phone: string; phones?: string[]; phoneIdentities?: string[] }>>(),
    Supplier.find({
      name: { $in: readyNames.map((name) => new RegExp(`^${name}$`, 'i')) },
    })
      .select({ name: 1 })
      .lean<Array<{ name: string }>>(),
  ]);

  const existingPhones = new Set<string>();
  for (const s of existingByPhone) {
    if (s.phone) existingPhones.add(s.phone);
    (s.phones || []).forEach((p) => p && existingPhones.add(p));
    (s.phoneIdentities || []).forEach((p) => p && existingPhones.add(p));
  }

  const existingNames = new Set<string>();
  for (const s of existingByName) {
    if (s.name) existingNames.add(s.name.trim().toLowerCase());
  }

  const rowsToCreate: typeof readyRows = [];

  for (const row of readyRows) {
    const phones = getNormalizedPhones(row.payload);
    const primaryPhone = phones[0] ?? '';
    const normalizedName = row.payload.name.trim().toLowerCase();

    const conflictingPhone = phones.find((phone) => existingPhones.has(phone));
    if (conflictingPhone) {
      report.skippedExisting += 1;
      report.skipped.push({
        rowNumber: row.rowNumber,
        reason: 'skippedExisting',
        name: toNonEmptyString(row.payload.name),
        phone: primaryPhone,
        details:
          conflictingPhone !== primaryPhone
            ? `Phone conflict: ${conflictingPhone}`
            : 'Phone conflict',
      });
      continue;
    }

    if (existingNames.has(normalizedName)) {
      report.skippedExisting += 1;
      report.skipped.push({
        rowNumber: row.rowNumber,
        reason: 'skippedExisting',
        name: toNonEmptyString(row.payload.name),
        phone: primaryPhone,
        details: 'Name conflict',
      });
      continue;
    }

    if (await validateSupplierPayload(row.rowNumber, row.payload, report)) {
      rowsToCreate.push(row);
      phones.forEach((phone) => existingPhones.add(phone));
      existingNames.add(normalizedName);
    }
  }

  report.prepared = rowsToCreate.length;

  if (rowsToCreate.length > 0) {
    const createdSuppliers = await Supplier.insertMany(
      rowsToCreate.map((row) => row.payload),
      { ordered: false },
    );
    report.created = createdSuppliers.length;
    report.suppliers = createdSuppliers.map((supplier) =>
      formatSupplier(supplier.toObject<SupplierDocument>()),
    );
  }

  return report;
};

export const exportSuppliersWorkbook = async () => {
  const suppliers = await Supplier.find()
    .sort({ createdAt: -1 })
    .lean<SupplierDocument[]>();

  const worksheet = XLSX.utils.json_to_sheet(
    suppliers.map((supplier) => {
      const phones =
        Array.isArray(supplier.phones) && supplier.phones.length > 0
          ? supplier.phones
          : supplier.phone
            ? [supplier.phone]
            : [];
      const additional = phones.length > 1 ? phones.slice(1).join('; ') : '';
      return {
        Id: supplier._id.toString(),
        Name: supplier.name,
        Phone: phones[0] || supplier.phone || '',
        'Additional Phones': additional,
        Status: supplier.isActive ? 'active' : 'inactive',
        'Supplier Order': supplier.supplierOrder ?? '',
        Note: supplier.note ?? '',
        'Created At': supplier.createdAt.toISOString(),
        'Updated At': supplier.updatedAt.toISOString(),
      };
    }),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');

  return XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xls',
  });
};
