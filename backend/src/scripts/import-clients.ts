import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Client } from '../domain/client/model';
import {
  importClientsWorkbook,
  parseClientImportRow,
  readClientImportRowsFromBuffer,
  extractPhones,
  type ClientImportReport,
} from '../domain/client/excel';

const defaultReportPath = path.resolve(process.cwd(), 'tmp/client-import-report.json');

export { extractPhones, parseClientImportRow };

const getArgValue = (name: string, fallback = '') => {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length).trim();
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return process.argv[index + 1]?.trim() ?? fallback;
  }

  return fallback;
};

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const writeReport = async (
  report: ClientImportReport & {
    dryRun: boolean;
    file: string;
    reportPath: string;
  },
) => {
  await fs.mkdir(path.dirname(report.reportPath), { recursive: true });
  await fs.writeFile(report.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
};

const createDryRunReport = (buffer: Buffer, file: string, reportPath: string) => {
  const { sheetName, rows } = readClientImportRowsFromBuffer(buffer);
  const parsedRows = rows.map((row, index) => parseClientImportRow(row, index + 2));
  const report: ClientImportReport & {
    dryRun: boolean;
    file: string;
    reportPath: string;
  } = {
    dryRun: true,
    file,
    sheetName,
    reportPath,
    totalRows: rows.length,
    prepared: 0,
    created: 0,
    skippedMissingRequired: 0,
    skippedExisting: 0,
    validationFailed: 0,
    skipped: [],
    validationErrors: [],
    clients: [],
  };

  parsedRows.forEach((parsed) => {
    if (parsed.status === 'skipped') {
      report.skippedMissingRequired += 1;
      report.skipped.push({
        rowNumber: parsed.rowNumber,
        reason: parsed.reason,
        name: parsed.name,
        phone: parsed.phone,
      });
      return;
    }

    report.prepared += 1;
  });

  return report;
};

const runImport = async () => {
  const dryRun = hasFlag('dry-run');
  const file = getArgValue('file');
  const reportPath = path.resolve(getArgValue('report', defaultReportPath));

  if (!file) {
    throw new Error('Missing required --file argument.');
  }

  const buffer = await fs.readFile(file);
  await connectDatabase();

  const report = dryRun
    ? createDryRunReport(buffer, file, reportPath)
    : {
        ...(await importClientsWorkbook(buffer)),
        dryRun: false,
        file,
        reportPath,
      };

  if (dryRun) {
    const readyPhones = report.skipped
      .map((item) => item.phone)
      .filter((phone): phone is string => Boolean(phone));
    const existingPhones = new Set(
      (
        await Client.find({ phone: { $in: readyPhones } })
          .select({ phone: 1 })
          .lean<Array<{ phone: string }>>()
      ).map((client) => client.phone),
    );
    report.skippedExisting = existingPhones.size;
  }

  await writeReport(report);

  console.log(`Client import ${dryRun ? 'dry-run' : 'completed'}.`);
  console.log(`Rows read: ${report.totalRows}`);
  console.log(`Prepared to create: ${report.prepared}`);
  console.log(`Created: ${report.created}`);
  console.log(`Skipped missing required: ${report.skippedMissingRequired}`);
  console.log(`Skipped existing: ${report.skippedExisting}`);
  console.log(`Validation failed: ${report.validationFailed}`);
  console.log(`Report: ${report.reportPath}`);
};

if (require.main === module) {
  void runImport()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
