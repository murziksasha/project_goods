import * as XLSX from 'xlsx';
import i18n from '../i18n/config';
import { triggerBrowserFileDownload } from './download-blob';

export type ExportFilterEntry = {
  filter: string;
  value: string;
};

export type ExportDefinitionEntry = {
  metric: string;
  definition: string;
};

export type ExportSheetSpec = {
  name: string;
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
  emptyRow?: Record<string, string | number>;
};

export type ReportWorkbookInput = {
  title: string;
  generatedAt?: string;
  timeZone?: string;
  activeFilters: ExportFilterEntry[];
  definitions: ExportDefinitionEntry[];
  warnings: string[];
  sheets: ExportSheetSpec[];
};

const sanitizeSheetName = (rawName: string) =>
  rawName.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || i18n.t('common.reportExport.sheetFallback');

export const buildReportWorkbook = ({
  title,
  generatedAt = new Date().toISOString(),
  timeZone = 'Europe/Kiev',
  activeFilters,
  definitions,
  warnings,
  sheets,
}: ReportWorkbookInput): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  const colSection = i18n.t('common.reportExport.colSection');
  const colKey = i18n.t('common.reportExport.colKey');
  const colValue = i18n.t('common.reportExport.colValue');
  const colStatus = i18n.t('common.reportExport.colStatus');

  for (const sheetSpec of sheets) {
    const dataRows =
      sheetSpec.rows.length > 0
        ? sheetSpec.rows
        : [
            sheetSpec.emptyRow ?? {
              [colStatus]: i18n.t('common.reportExport.emptyFilters'),
            },
          ];
    const sheet = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      sanitizeSheetName(sheetSpec.name),
    );
  }

  const metadataRows: Array<Record<string, string>> = [
    {
      [colSection]: i18n.t('common.reportExport.sectionReport'),
      [colKey]: i18n.t('common.reportExport.keyTitle'),
      [colValue]: title,
    },
    {
      [colSection]: i18n.t('common.reportExport.sectionReport'),
      [colKey]: i18n.t('common.reportExport.keyGeneratedAt'),
      [colValue]: generatedAt,
    },
    {
      [colSection]: i18n.t('common.reportExport.sectionReport'),
      [colKey]: i18n.t('common.reportExport.keyTimeZone'),
      [colValue]: timeZone,
    },
    ...activeFilters.map((f) => ({
      [colSection]: i18n.t('common.reportExport.sectionFilter'),
      [colKey]: f.filter,
      [colValue]: f.value || i18n.t('common.reportExport.all'),
    })),
    ...definitions.map((d) => ({
      [colSection]: i18n.t('common.reportExport.sectionDefinition'),
      [colKey]: d.metric,
      [colValue]: d.definition,
    })),
    ...(warnings.length > 0
      ? warnings.map((w, idx) => ({
          [colSection]: i18n.t('common.reportExport.sectionWarning'),
          [colKey]: i18n.t('common.reportExport.warningN', { count: idx + 1 }),
          [colValue]: w,
        }))
      : [
          {
            [colSection]: i18n.t('common.reportExport.sectionWarning'),
            [colKey]: i18n.t('common.reportExport.warningStatus'),
            [colValue]: i18n.t('common.reportExport.noWarnings'),
          },
        ]),
  ];

  const metaSheet = XLSX.utils.json_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(
    workbook,
    metaSheet,
    i18n.t('common.reportExport.metadataSheet'),
  );

  return workbook;
};

export const exportReportWorkbookToDownload = ({
  filename,
  ...input
}: ReportWorkbookInput & { filename: string }) => {
  const workbook = buildReportWorkbook(input);
  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBrowserFileDownload(blob, filename);
  return workbook;
};
