export type ScenarioDomain = 'warehouse' | 'cashflow';

export type WarehouseScenarioAssumptions = {
  demandMultiplier: number;
  leadTimeDays: number;
  safetyStockDays: number;
  includePendingSupplierOrders: boolean;
};

export type PlannedCashEvent = {
  id: string;
  title: string;
  type: 'inflow' | 'outflow';
  amount: number;
  currency: string;
  scheduledDate: string;
  obligationKind?: 'supplier_order' | 'sale_balance' | null;
  obligationId?: string | null;
};

export type CashflowScenarioAssumptions = {
  currency?: string;
  demandMultiplier: number;
  inflowMultiplier: number;
  outflowMultiplier: number;
  inflowTimingShiftDays: number;
  outflowTimingShiftDays: number;
  plannedEvents: PlannedCashEvent[];
};

export type ScenarioRecord = {
  id: string;
  employeeId: string;
  domain: ScenarioDomain;
  name: string;
  horizonDays: 30 | 60 | 90;
  assumptions: WarehouseScenarioAssumptions | CashflowScenarioAssumptions | Record<string, unknown>;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateScenarioPayload = {
  domain: ScenarioDomain;
  name: string;
  horizonDays: 30 | 60 | 90;
  assumptions: Record<string, unknown>;
  filters?: Record<string, unknown>;
};

export type UpdateScenarioPayload = {
  name?: string;
  horizonDays?: 30 | 60 | 90;
  assumptions?: Record<string, unknown>;
  filters?: Record<string, unknown>;
};
