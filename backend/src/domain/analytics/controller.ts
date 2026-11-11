import type { Request, Response } from 'express';
import { getDashboardAnalytics } from './service';
import {
  getWarehouseReport,
  getWarehouseReportDetails,
  type WarehouseReportQuery,
} from './warehouse-report';
import {
  getOrdersProcurementDetails,
  getOrdersProcurementReport,
  getOrdersRepairsDetails,
  getOrdersRepairsReport,
  getOrdersSalesDetails,
  getOrdersSalesReport,
  type ProcurementReportQuery,
  type RepairsReportQuery,
  type SalesReportQuery,
} from './orders-report';
import { employeeHasPermission } from '../auth/service';
import { requireAnyPermission, requirePermission } from '../../shared/lib/http';

export const analyticsReadPermissions = [
  'orders.view',
  'sales.manage',
  'finance.view',
] as const;

export const repairsReportPermissions = [
  'orders.view',
  'orders.manage',
  'repairs.execute',
  'kanban.use',
] as const;

export const salesReportPermissions = ['orders.view', 'sales.manage'] as const;

export const procurementReportPermissions = [
  'supplierOrders.view',
  'supplierOrders.manage',
] as const;

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  await requireAnyPermission(req, analyticsReadPermissions);
  res.json(
    await getDashboardAnalytics({
      period: String(req.query.period ?? ''),
      dateFrom: String(req.query.dateFrom ?? ''),
      dateTo: String(req.query.dateTo ?? ''),
    }),
  );
};

export const getWarehouseReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await getWarehouseReport(req.query as WarehouseReportQuery));
};

export const getWarehouseReportDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requirePermission(req, 'inventory.manage');
  res.json(await getWarehouseReportDetails(req.query as WarehouseReportQuery));
};

export const getRepairsReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requireAnyPermission(req, repairsReportPermissions);
  res.json(await getOrdersRepairsReport(req.query as RepairsReportQuery));
};

export const getRepairsDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requireAnyPermission(req, repairsReportPermissions);
  res.json(await getOrdersRepairsDetails(req.query as RepairsReportQuery));
};

export const getSalesReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const employee = await requireAnyPermission(req, salesReportPermissions);
  res.json(
    await getOrdersSalesReport(req.query as SalesReportQuery, {
      includeCosts: employeeHasPermission(employee, 'finance.view'),
    }),
  );
};

export const getSalesDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requireAnyPermission(req, salesReportPermissions);
  res.json(await getOrdersSalesDetails(req.query as SalesReportQuery));
};

export const getProcurementReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requireAnyPermission(req, procurementReportPermissions);
  res.json(
    await getOrdersProcurementReport(req.query as ProcurementReportQuery),
  );
};

export const getProcurementDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await requireAnyPermission(req, procurementReportPermissions);
  res.json(
    await getOrdersProcurementDetails(req.query as ProcurementReportQuery),
  );
};

