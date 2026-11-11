import * as XLSX from 'xlsx';
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
  rawName.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';

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

  for (const sheetSpec of sheets) {
    const dataRows =
      sheetSpec.rows.length > 0
        ? sheetSpec.rows
        : [sheetSpec.emptyRow ?? { Status: 'No matching records for active filters' }];
    const sheet = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      sanitizeSheetName(sheetSpec.name),
    );
  }

  const metadataRows: Array<Record<string, string>> = [
    { Section: 'Report', Key: 'Title', Value: title },
    { Section: 'Report', Key: 'Generated At (UTC)', Value: generatedAt },
    { Section: 'Report', Key: 'Business Time Zone', Value: timeZone },
    ...activeFilters.map((f) => ({
      Section: 'Active Filter',
      Key: f.filter,
      Value: f.value || 'All',
    })),
    ...definitions.map((d) => ({
      Section: 'Metric Definition',
      Key: d.metric,
      Value: d.definition,
    })),
    ...(warnings.length > 0
      ? warnings.map((w, idx) => ({
          Section: 'Coverage Warning',
          Key: `Warning ${idx + 1}`,
          Value: w,
        }))
      : [
          {
            Section: 'Coverage Warning',
            Key: 'Status',
            Value: 'No data coverage warnings for this selection.',
          },
        ]),
  ];

  const metaSheet = XLSX.utils.json_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Metadata & Definitions');

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
