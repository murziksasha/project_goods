import { Router } from 'express';
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
} from '../domain/archive/yearly-dump';
import {
  ensureFinancePeriodSealed,
  getFinanceRawTxCutoff,
  listFinancePeriodSnapshots,
  purgeFinanceTransactionsBeforeActiveSnapshot,
  sealFinancePeriodSnapshot,
  FINANCE_RAW_TX_RETENTION_MONTHS,
  FINANCE_RAW_TX_RETENTION_YEARS,
} from '../domain/finance/period-snapshot';
import { asyncHandler, requirePermission, routeParam } from '../shared/lib/http';
import { HttpError } from '../shared/lib/errors';

export const archiveRouter = Router();

const requireArchivePermission = (req: Parameters<typeof requirePermission>[0]) =>
  requirePermission(
    req,
    'system.backups.manage',
    'Only employees with system.backups.manage can manage archives.',
  );

archiveRouter.get(
  '/archive/yearly',
  asyncHandler(async (req, res) => {
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
  }),
);

archiveRouter.post(
  '/archive/yearly/sales/:year',
  asyncHandler(async (req, res) => {
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
  }),
);

archiveRouter.post(
  '/archive/yearly/finance/:year',
  asyncHandler(async (req, res) => {
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
  }),
);

archiveRouter.post(
  '/archive/yearly/run',
  asyncHandler(async (req, res) => {
    await requireArchivePermission(req);
    res.json(await runScheduledYearlyArchives('System'));
  }),
);

archiveRouter.post(
  '/archive/finance/seal',
  asyncHandler(async (req, res) => {
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
  }),
);

archiveRouter.post(
  '/archive/finance/seal/auto',
  asyncHandler(async (req, res) => {
    await requireArchivePermission(req);
    res.json(await ensureFinancePeriodSealed('System'));
  }),
);

archiveRouter.post(
  '/archive/finance/purge',
  asyncHandler(async (req, res) => {
    const employee = await requireArchivePermission(req);
    res.json(
      await purgeFinanceTransactionsBeforeActiveSnapshot(
        employee.name,
        (req.body as { confirmation?: unknown })?.confirmation,
      ),
    );
  }),
);
