import type { Request, Response } from 'express';
import { getDashboardAnalytics } from './service';
import { requireAnyPermission } from '../../shared/lib/http';

export const analyticsReadPermissions = [
  'orders.view',
  'sales.manage',
  'finance.view',
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

