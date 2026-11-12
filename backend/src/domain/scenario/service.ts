import { HttpError, isDuplicateKeyError } from '../../shared/lib/errors';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { Scenario, scenarioDomains, type ScenarioDocument, type ScenarioDomain } from './model';

const MAX_SCENARIOS_PER_DOMAIN = 50;
const VALID_HORIZONS = new Set([30, 60, 90]);

export const canonicalScenarioDomain = (value: unknown): ScenarioDomain | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return scenarioDomains.find((domain) => domain.toLowerCase() === normalized) ?? null;
};

const normalizeDomain = (value: unknown): ScenarioDomain => {
  const domain = canonicalScenarioDomain(value);
  if (domain) return domain;
  throw new HttpError(400, 'Scenario domain must be "warehouse", "cashflow", or "ordersReport".');
};

const normalizeName = (value: unknown) => {
  const name = String(value ?? '').trim();
  if (!name) {
    throw new HttpError(400, 'Scenario name is required.');
  }
  if (name.length > 100) {
    throw new HttpError(400, 'Scenario name must contain no more than 100 characters.');
  }
  return name;
};

const normalizeHorizon = (value: unknown): 30 | 60 | 90 => {
  if (value === undefined || value === null || value === '') return 30;
  const parsed = Number(value);
  if (!VALID_HORIZONS.has(parsed)) {
    throw new HttpError(400, 'Scenario horizonDays must be 30, 60, or 90.');
  }
  return parsed as 30 | 60 | 90;
};

const toPlainRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `Scenario ${label} must be an object.`);
  }
  return { ...(value as Record<string, unknown>) };
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};


const ORDERS_REPORT_KINDS = new Set(['repairs', 'sales', 'procurement']);
const ORDERS_REPORT_MODES = new Set(['register', 'summary']);
const ORDERS_REPORT_GROUP_BY = new Set([
  'master',
  'status',
  'manager',
  'client',
  'supplier',
  'day',
  'week',
  'month',
  'product',
  'service',
]);

const normalizeStringArray = (value: unknown, max: number): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const s = String(item ?? '').trim();
    if (s && !out.includes(s) && out.length < max) out.push(s);
  }
  return out;
};

const normalizeOrdersReportAssumptions = (
  obj: Record<string, unknown>,
): Record<string, unknown> => {
  const kindRaw = String(obj.kind ?? 'repairs').trim();
  const modeRaw = String(obj.mode ?? 'register').trim();
  const groupBy = normalizeStringArray(obj.groupBy, 10)
    .filter((item) => ORDERS_REPORT_GROUP_BY.has(item))
    .slice(0, 2);
  const columns = normalizeStringArray(obj.columns, 60);
  const filtersRaw =
    obj.filters && typeof obj.filters === 'object' && !Array.isArray(obj.filters)
      ? (obj.filters as Record<string, unknown>)
      : {};
  const sortRaw =
    obj.sort && typeof obj.sort === 'object' && !Array.isArray(obj.sort)
      ? (obj.sort as Record<string, unknown>)
      : {};
  const sortDir = String(sortRaw.sortDir ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const columnsByKindRaw =
    obj.columnsByKind &&
    typeof obj.columnsByKind === 'object' &&
    !Array.isArray(obj.columnsByKind)
      ? (obj.columnsByKind as Record<string, unknown>)
      : {};
  const columnsByKind: Record<string, string[]> = {};
  for (const key of ['repairs', 'sales', 'procurement']) {
    if (Array.isArray(columnsByKindRaw[key])) {
      columnsByKind[key] = normalizeStringArray(columnsByKindRaw[key], 60);
    }
  }
  return {
    kind: ORDERS_REPORT_KINDS.has(kindRaw) ? kindRaw : 'repairs',
    mode: ORDERS_REPORT_MODES.has(modeRaw) ? modeRaw : 'register',
    filters: { ...filtersRaw },
    columns,
    columnsByKind,
    groupBy,
    sort: {
      sortBy: String(sortRaw.sortBy ?? '').trim() || 'saleDate',
      sortDir,
    },
  };
};

export const normalizeScenarioAssumptions = (
  domain: ScenarioDomain,
  raw: unknown,
): Record<string, unknown> => {
  const obj = toPlainRecord(raw, 'assumptions');
  if (domain === 'warehouse') {
    return {
      demandMultiplier: clampNumber(obj.demandMultiplier, 1, 0, 10),
      leadTimeDays: Math.round(clampNumber(obj.leadTimeDays, 14, 0, 365)),
      safetyStockDays: Math.round(clampNumber(obj.safetyStockDays, 7, 0, 365)),
      includePendingSupplierOrders:
        obj.includePendingSupplierOrders === undefined
          ? true
          : Boolean(obj.includePendingSupplierOrders),
    };
  }

  if (domain === 'ordersReport') {
    return normalizeOrdersReportAssumptions(obj);
  }

  const rawEvents = Array.isArray(obj.plannedEvents) ? obj.plannedEvents : [];
  const plannedEvents = rawEvents
    .filter((entry) => entry && typeof entry === 'object')
    .slice(0, 100)
    .map((entry, idx) => {
      const e = entry as Record<string, unknown>;
      const amount = Number(e.amount ?? 0);
      return {
        id: String(e.id ?? `evt-${idx + 1}`).trim() || `evt-${idx + 1}`,
        title: String(e.title ?? '').trim().slice(0, 120),
        type: e.type === 'outflow' ? 'outflow' : 'inflow',
        amount: Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : 0,
        currency: String(e.currency ?? 'UAH').trim().toUpperCase() || 'UAH',
        scheduledDate: String(e.scheduledDate ?? '').trim(),
        obligationKind:
          e.obligationKind === 'supplier_order' || e.obligationKind === 'sale_balance'
            ? e.obligationKind
            : null,
        obligationId: e.obligationId ? String(e.obligationId).trim() : null,
      };
    });

  return {
    currency: obj.currency ? String(obj.currency).trim().toUpperCase() : undefined,
    demandMultiplier: clampNumber(obj.demandMultiplier, 1, 0, 10),
    inflowMultiplier: clampNumber(obj.inflowMultiplier, 1, 0, 10),
    outflowMultiplier: clampNumber(obj.outflowMultiplier, 1, 0, 10),
    inflowTimingShiftDays: Math.round(clampNumber(obj.inflowTimingShiftDays, 0, -60, 60)),
    outflowTimingShiftDays: Math.round(clampNumber(obj.outflowTimingShiftDays, 0, -60, 60)),
    plannedEvents,
  };
};

export const formatScenario = (doc: ScenarioDocument) => ({
  id: doc._id.toString(),
  employeeId: doc.employeeId.toString(),
  domain: doc.domain as ScenarioDomain,
  name: doc.name,
  horizonDays: (doc.horizonDays === 60 || doc.horizonDays === 90 ? doc.horizonDays : 30) as 30 | 60 | 90,
  assumptions: (doc.assumptions ?? {}) as Record<string, unknown>,
  filters: (doc.filters ?? {}) as Record<string, unknown>,
  createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
  updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ''),
});

export const listScenarios = async (
  employeeId: string,
  allowedDomains: readonly ScenarioDomain[],
  requestedDomain?: unknown,
) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');
  const query: Record<string, unknown> = { employeeId };

  if (requestedDomain !== undefined && String(requestedDomain).trim() !== '') {
    const domain = normalizeDomain(requestedDomain);
    if (!allowedDomains.includes(domain)) {
      throw new HttpError(403, 'Current employee does not have permission for this scenario domain.');
    }
    query.domain = domain;
  } else {
    if (allowedDomains.length === 0) {
      throw new HttpError(403, 'Current employee does not have permission to view scenarios.');
    }
    query.domain = { $in: allowedDomains };
  }

  const docs = await Scenario.find(query)
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean<ScenarioDocument[]>();

  return docs.map(formatScenario);
};

export const createScenario = async (
  employeeId: string,
  payload: Record<string, unknown>,
) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');
  const domain = normalizeDomain(payload.domain);
  const name = normalizeName(payload.name);
  const horizonDays = normalizeHorizon(payload.horizonDays);
  const assumptions = normalizeScenarioAssumptions(domain, payload.assumptions);
  const filters = toPlainRecord(payload.filters, 'filters');

  const count = await Scenario.countDocuments({ employeeId, domain });
  if (count >= MAX_SCENARIOS_PER_DOMAIN) {
    throw new HttpError(400, `Scenario limit reached (maximum ${MAX_SCENARIOS_PER_DOMAIN} per domain).`);
  }

  try {
    const created = await Scenario.create({
      employeeId,
      domain,
      name,
      horizonDays,
      assumptions,
      filters,
    });
    return formatScenario(created.toObject<ScenarioDocument>());
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'A scenario with this name already exists.');
    }
    throw error;
  }
};

export const updateScenario = async (
  employeeId: string,
  scenarioId: string,
  payload: Record<string, unknown>,
  allowedDomains: readonly ScenarioDomain[],
) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');
  isValidObjectIdOrThrow(scenarioId, 'scenarioId');

  const existing = await Scenario.findById(scenarioId);
  if (!existing) {
    throw new HttpError(404, 'Scenario not found.');
  }
  if (existing.employeeId.toString() !== employeeId) {
    throw new HttpError(403, 'Cannot modify another employee scenario.');
  }
  const domain = existing.domain as ScenarioDomain;
  if (!allowedDomains.includes(domain)) {
    throw new HttpError(403, 'Current employee does not have permission for this scenario domain.');
  }

  if (payload.name !== undefined) {
    existing.name = normalizeName(payload.name);
  }
  if (payload.horizonDays !== undefined) {
    existing.horizonDays = normalizeHorizon(payload.horizonDays);
  }
  if (payload.assumptions !== undefined) {
    existing.assumptions = normalizeScenarioAssumptions(domain, payload.assumptions);
  }
  if (payload.filters !== undefined) {
    existing.filters = toPlainRecord(payload.filters, 'filters');
  }

  try {
    await existing.save();
    return formatScenario(existing.toObject<ScenarioDocument>());
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, 'A scenario with this name already exists.');
    }
    throw error;
  }
};

export const deleteScenario = async (
  employeeId: string,
  scenarioId: string,
  allowedDomains: readonly ScenarioDomain[],
) => {
  isValidObjectIdOrThrow(employeeId, 'employeeId');
  isValidObjectIdOrThrow(scenarioId, 'scenarioId');

  const existing = await Scenario.findById(scenarioId).lean<ScenarioDocument | null>();
  if (!existing) {
    throw new HttpError(404, 'Scenario not found.');
  }
  if (existing.employeeId.toString() !== employeeId) {
    throw new HttpError(403, 'Cannot delete another employee scenario.');
  }
  if (!allowedDomains.includes(existing.domain as ScenarioDomain)) {
    throw new HttpError(403, 'Current employee does not have permission for this scenario domain.');
  }

  await Scenario.deleteOne({ _id: scenarioId, employeeId });
  return { deleted: true, id: scenarioId };
};
