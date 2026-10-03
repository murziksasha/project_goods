import type { Request, Response } from 'express';
import {
  countStaleOpenSales,
  createYearlyFinanceDump,
  createYearlySalesDump,
  listEligibleFinanceArchiveYears,
  listEligibleSalesArchiveYears,
  listYearlyArchives,
  runScheduledYearlyArchives,
  SALES_HOT_MONTHS,
  SALES_PURGE_CONFIRMATION,
} from './yearly-dump';
import {
  ensureFinancePeriodSealed,
  getFinanceRawTxCutoff,
  listFinancePeriodSnapshots,
  purgeFinanceTransactionsBeforeActiveSnapshot,
  sealFinancePeriodSnapshot,
  FINANCE_RAW_TX_RETENTION_MONTHS,
  FINANCE_RAW_TX_RETENTION_YEARS,
} from '../finance/period-snapshot';
import { requirePermission, routeParam } from '../../shared/lib/http';
import { HttpError } from '../../shared/lib/errors';

export const requireArchivePermission = (req: Parameters<typeof requirePermission>[0]) =>
  requirePermission(
    req,
    'system.backups.manage',
    'Only employees with system.backups.manage can manage archives.',
  );

export const getYearly = async (req: Request, res: Response): Promise<void> => {
  await requireArchivePermission(req);
  res.json({
    hotMonths: SALES_HOT_MONTHS,
    financeRetentionMonths: FINANCE_RAW_TX_RETENTION_MONTHS,
    financeRetentionYears: FINANCE_RAW_TX_RETENTION_YEARS,
    financeCutoff: getFinanceRawTxCutoff().toISOString(),
    eligibleSalesYears: listEligibleSalesArchiveYears(),
    eligibleFinanceYears: listEligibleFinanceArchiveYears(),
    archives: await listYearlyArchives(),
    financeSnapshots: await listFinancePeriodSnapshots(),
    staleOpenSales: await countStaleOpenSales(),
  });
};

export const archiveYearlySales = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireArchivePermission(req);
  const year = Number.parseInt(routeParam(req, 'year'), 10);
  if (!Number.isFinite(year)) {
    throw new HttpError(400, 'Invalid year.');
  }
  const body = (req.body ?? {}) as { purge?: unknown; confirmation?: unknown };
  const purge =
    String(body.purge ?? '').toLowerCase() === 'true' || body.purge === true;
  if (purge && String(body.confirmation ?? '') !== SALES_PURGE_CONFIRMATION) {
    throw new HttpError(400, `Confirmation phrase must be ${SALES_PURGE_CONFIRMATION}.`);
  }
  res.status(201).json(
    await createYearlySalesDump(year, employee.name, {
      purge,
      confirmation: purge ? body.confirmation : undefined,
    }),
  );
};

export const archiveYearlyFinance = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireArchivePermission(req);
  const year = Number.parseInt(routeParam(req, 'year'), 10);
  if (!Number.isFinite(year)) {
    throw new HttpError(400, 'Invalid year.');
  }
  const body = (req.body ?? {}) as { purge?: unknown };
  const purge =
    String(body.purge ?? '').toLowerCase() === 'true' || body.purge === true;
  if (purge) {
    throw new HttpError(
      400,
      'Finance live purge is only allowed via period seal + PURGE_FINANCE. Yearly finance dump is offline-only.',
    );
  }
  res.status(201).json(await createYearlyFinanceDump(year, employee.name, { purge: false }));
};

export const runScheduledArchives = async (req: Request, res: Response): Promise<void> => {
  await requireArchivePermission(req);
  res.json(await runScheduledYearlyArchives('System'));
};

export const sealFinancePeriod = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireArchivePermission(req);
  const body = req.body as { periodEnd?: unknown };
  const periodEnd =
    body.periodEnd !== undefined && body.periodEnd !== null && body.periodEnd !== ''
      ? new Date(String(body.periodEnd))
      : undefined;
  if (periodEnd && Number.isNaN(periodEnd.getTime())) {
    throw new HttpError(400, 'Invalid periodEnd.');
  }
  res.status(201).json(await sealFinancePeriodSnapshot(employee.name, { periodEnd }));
};

export const sealFinancePeriodAuto = async (req: Request, res: Response): Promise<void> => {
  await requireArchivePermission(req);
  res.json(await ensureFinancePeriodSealed('System'));
};

export const purgeFinance = async (req: Request, res: Response): Promise<void> => {
  const employee = await requireArchivePermission(req);
  res.json(
    await purgeFinanceTransactionsBeforeActiveSnapshot(
      employee.name,
      (req.body as { confirmation?: unknown })?.confirmation,
    ),
  );
};

