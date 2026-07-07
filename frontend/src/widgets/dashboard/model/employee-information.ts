import type { Employee, EmployeeRole } from '../../../entities/employee/model/types';
import { employeeRoleOptions } from '../../../entities/employee/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { getSaleTotal } from './sales-analytics';

export type EmployeeInformationView =
  | 'achievements'
  | 'orders'
  | 'repairs'
  | 'sales';
export type EmployeeInformationSortKey =
  | 'count'
  | 'revenue'
  | 'latest'
  | 'orders'
  | 'repairs'
  | 'sales';

export type EmployeeInformationFilters = {
  search: string;
  role: EmployeeRole | 'all';
  sort: EmployeeInformationSortKey;
  sortDirection: 'asc' | 'desc';
  dateFrom: string;
  dateTo: string;
};

export type EmployeeAchievements = {
  ordersCreated: number;
  repairsAsMaster: number;
  repairsCompleted: number;
  salesAsManager: number;
  ordersRevenue: number;
  repairsRevenue: number;
  salesRevenue: number;
  latestActivityDate: string | null;
};

export type EmployeeInformationSummary = {
  activeEmployees: number;
  ordersInPeriod: number;
  repairsInPeriod: number;
  salesInPeriod: number;
  salesRevenue: number;
  repairsRevenue: number;
};

export type EmployeeInformationRow = {
  id: string;
  name: string;
  username: string;
  role: EmployeeRole;
  isActive: boolean;
  achievements: EmployeeAchievements;
  count: number;
  revenue: number;
  completedCount: number;
  avgTicket: number;
  sharePercent: number;
  latestActivityDate: string | null;
};

export type EmployeeInformationReport = {
  summary: EmployeeInformationSummary;
  rows: EmployeeInformationRow[];
};

const finalRepairStatuses = new Set([
  'issued',
  'issuedWithoutRepair',
  'clientRejected',
  'paid',
]);

const emptyAchievements = (): EmployeeAchievements => ({
  ordersCreated: 0,
  repairsAsMaster: 0,
  repairsCompleted: 0,
  salesAsManager: 0,
  ordersRevenue: 0,
  repairsRevenue: 0,
  salesRevenue: 0,
  latestActivityDate: null,
});

const normalizeText = (value: string | null | undefined) =>
  String(value ?? '').trim().toLowerCase();

const getLatestDate = (current: string | null, candidate: string | null) => {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime()
    ? candidate
    : current;
};

const isSaleInDateRange = (
  sale: Sale,
  dateFrom: string,
  dateTo: string,
) => {
  const saleDate = sale.createdAt?.slice(0, 10) ?? '';
  if (!saleDate) return false;
  if (dateFrom && saleDate < dateFrom) return false;
  if (dateTo && saleDate > dateTo) return false;
  return true;
};

const getFilteredSales = (sales: Sale[], filters: EmployeeInformationFilters) => {
  if (!filters.dateFrom && !filters.dateTo) {
    return sales;
  }
  return sales.filter((sale) =>
    isSaleInDateRange(sale, filters.dateFrom, filters.dateTo),
  );
};

const getSortMetric = (
  row: EmployeeInformationRow,
  view: EmployeeInformationView,
  sort: EmployeeInformationSortKey,
) => {
  if (view === 'achievements') {
    if (sort === 'orders') return row.achievements.ordersCreated;
    if (sort === 'repairs') return row.achievements.repairsAsMaster;
    if (sort === 'sales') return row.achievements.salesAsManager;
    if (sort === 'revenue') {
      return (
        row.achievements.ordersRevenue +
        row.achievements.repairsRevenue
      );
    }
    if (sort === 'latest') {
      return new Date(row.achievements.latestActivityDate ?? 0).getTime();
    }
    return (
      row.achievements.ordersCreated +
      row.achievements.repairsAsMaster +
      row.achievements.salesAsManager
    );
  }

  if (sort === 'revenue') return row.revenue;
  if (sort === 'latest') {
    return new Date(row.latestActivityDate ?? 0).getTime();
  }
  return row.count;
};

const sortRows = (
  rows: EmployeeInformationRow[],
  view: EmployeeInformationView,
  sort: EmployeeInformationSortKey,
  direction: EmployeeInformationFilters['sortDirection'],
) =>
  [...rows].sort((first, second) => {
    const multiplier = direction === 'asc' ? 1 : -1;
    return (
      (getSortMetric(first, view, sort) - getSortMetric(second, view, sort)) *
      multiplier
    );
  });

const matchesEmployeeFilters = (
  employee: Employee,
  filters: EmployeeInformationFilters,
) => {
  const search = normalizeText(filters.search);
  if (
    search &&
    ![
      employee.name,
      employee.role,
      employee.username,
      employee.email,
      employee.phone,
    ]
      .map(normalizeText)
      .some((value) => value.includes(search))
  ) {
    return false;
  }
  if (filters.role !== 'all' && employee.role !== filters.role) {
    return false;
  }
  return true;
};

const buildAchievementsMap = (
  activeEmployees: Employee[],
  sales: Sale[],
) => {
  const achievementsByEmployeeId = new Map<string, EmployeeAchievements>();

  activeEmployees.forEach((employee) => {
    achievementsByEmployeeId.set(employee.id, emptyAchievements());
  });

  sales.forEach((sale) => {
    const saleDate = sale.createdAt ?? null;
    const revenue = getSaleTotal(sale);
    const managerId = sale.manager?.id;

    if (managerId && achievementsByEmployeeId.has(managerId)) {
      const achievements = achievementsByEmployeeId.get(managerId)!;
      achievements.ordersCreated += 1;
      achievements.ordersRevenue += revenue;
      achievements.latestActivityDate = getLatestDate(
        achievements.latestActivityDate,
        saleDate,
      );

      if (sale.kind === 'sale') {
        achievements.salesAsManager += 1;
        achievements.salesRevenue += revenue;
      }
    }

    if (sale.kind === 'repair') {
      const masterId = sale.master?.id;
      if (!masterId || !achievementsByEmployeeId.has(masterId)) {
        return;
      }
      const achievements = achievementsByEmployeeId.get(masterId)!;
      achievements.repairsAsMaster += 1;
      achievements.repairsRevenue += revenue;
      if (finalRepairStatuses.has(String(sale.status ?? ''))) {
        achievements.repairsCompleted += 1;
      }
      achievements.latestActivityDate = getLatestDate(
        achievements.latestActivityDate,
        saleDate,
      );
    }
  });

  return achievementsByEmployeeId;
};

const getViewMetrics = (
  achievements: EmployeeAchievements,
  view: EmployeeInformationView,
) => {
  if (view === 'orders') {
    return {
      count: achievements.ordersCreated,
      revenue: achievements.ordersRevenue,
      completedCount: 0,
      avgTicket:
        achievements.ordersCreated > 0
          ? achievements.ordersRevenue / achievements.ordersCreated
          : 0,
      latestActivityDate: achievements.latestActivityDate,
    };
  }

  if (view === 'repairs') {
    return {
      count: achievements.repairsAsMaster,
      revenue: achievements.repairsRevenue,
      completedCount: achievements.repairsCompleted,
      avgTicket:
        achievements.repairsAsMaster > 0
          ? achievements.repairsRevenue / achievements.repairsAsMaster
          : 0,
      latestActivityDate: achievements.latestActivityDate,
    };
  }

  if (view === 'sales') {
    return {
      count: achievements.salesAsManager,
      revenue: achievements.salesRevenue,
      completedCount: 0,
      avgTicket:
        achievements.salesAsManager > 0
          ? achievements.salesRevenue / achievements.salesAsManager
          : 0,
      latestActivityDate: achievements.latestActivityDate,
    };
  }

  return {
    count:
      achievements.ordersCreated +
      achievements.repairsAsMaster +
      achievements.salesAsManager,
    revenue: achievements.ordersRevenue + achievements.repairsRevenue,
    completedCount: achievements.repairsCompleted,
    avgTicket:
      achievements.salesAsManager > 0
        ? achievements.salesRevenue / achievements.salesAsManager
        : 0,
    latestActivityDate: achievements.latestActivityDate,
  };
};

export const buildEmployeeInformationReport = ({
  employees,
  sales,
  view,
  filters,
}: {
  employees: Employee[];
  sales: Sale[];
  view: EmployeeInformationView;
  filters: EmployeeInformationFilters;
}): EmployeeInformationReport => {
  const activeEmployees = employees.filter((employee) => employee.isActive);
  const filteredSales = getFilteredSales(sales, filters);
  const achievementsByEmployeeId = buildAchievementsMap(
    activeEmployees,
    filteredSales,
  );

  const rawRows = activeEmployees
    .filter((employee) => matchesEmployeeFilters(employee, filters))
    .map((employee) => {
      const achievements =
        achievementsByEmployeeId.get(employee.id) ?? emptyAchievements();
      const metrics = getViewMetrics(achievements, view);

      return {
        id: employee.id,
        name: employee.name,
        username: employee.username,
        role: employee.role,
        isActive: employee.isActive,
        achievements,
        count: metrics.count,
        revenue: metrics.revenue,
        completedCount: metrics.completedCount,
        avgTicket: metrics.avgTicket,
        sharePercent: 0,
        latestActivityDate: metrics.latestActivityDate,
      } satisfies EmployeeInformationRow;
    });

  const leaderMetric = Math.max(
    ...rawRows.map((row) => getSortMetric(row, view, filters.sort)),
    0,
  );

  const rowsWithShare = rawRows.map((row) => {
    const metricValue = getSortMetric(row, view, filters.sort);
    return {
      ...row,
      sharePercent:
        leaderMetric > 0 ? (metricValue / leaderMetric) * 100 : 0,
    };
  });

  const ordersInPeriod = filteredSales.length;
  const repairsInPeriod = filteredSales.filter((sale) => sale.kind === 'repair').length;
  const salesInPeriod = filteredSales.filter((sale) => sale.kind === 'sale').length;
  const salesRevenue = filteredSales
    .filter((sale) => sale.kind === 'sale')
    .reduce((sum, sale) => sum + getSaleTotal(sale), 0);
  const repairsRevenue = filteredSales
    .filter((sale) => sale.kind === 'repair')
    .reduce((sum, sale) => sum + getSaleTotal(sale), 0);

  return {
    summary: {
      activeEmployees: activeEmployees.length,
      ordersInPeriod,
      repairsInPeriod,
      salesInPeriod,
      salesRevenue,
      repairsRevenue,
    },
    rows: sortRows(rowsWithShare, view, filters.sort, filters.sortDirection),
  };
};

export const employeeInformationRoleOptions = ['all', ...employeeRoleOptions] as const;