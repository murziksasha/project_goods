import { Router } from 'express';
import { getDashboardAnalytics } from '../domain/analytics/service';
import { asyncHandler, requireAnyPermission } from '../shared/lib/http';

export const analyticsRouter = Router();

const analyticsReadPermissions = [
  'orders.view',
  'sales.manage',
  'finance.view',
] as const;

analyticsRouter.get(
  '/analytics/dashboard',
  asyncHandler(async (req, res) => {
    await requireAnyPermission(req, analyticsReadPermissions);
    res.json(
      await getDashboardAnalytics({
        period: String(req.query.period ?? ''),
        dateFrom: String(req.query.dateFrom ?? ''),
        dateTo: String(req.query.dateTo ?? ''),
      }),
    );
  }),
);
