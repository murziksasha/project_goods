import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import * as controller from './controller';

export const analyticsRouter = Router();

analyticsRouter.get('/analytics/dashboard', asyncHandler(controller.getDashboard));
analyticsRouter.get('/reports/warehouse', asyncHandler(controller.getWarehouseReportHandler));
analyticsRouter.get('/reports/warehouse/details', asyncHandler(controller.getWarehouseReportDetailsHandler));
analyticsRouter.get('/reports/orders/repairs', asyncHandler(controller.getRepairsReportHandler));
analyticsRouter.get('/reports/orders/repairs/details', asyncHandler(controller.getRepairsDetailsHandler));
analyticsRouter.get('/reports/orders/sales', asyncHandler(controller.getSalesReportHandler));
analyticsRouter.get('/reports/orders/sales/details', asyncHandler(controller.getSalesDetailsHandler));
analyticsRouter.get('/reports/orders/procurement', asyncHandler(controller.getProcurementReportHandler));
analyticsRouter.get('/reports/orders/procurement/details', asyncHandler(controller.getProcurementDetailsHandler));
analyticsRouter.get('/reports/orders/table/repairs', asyncHandler(controller.getRepairsTableHandler));
analyticsRouter.get('/reports/orders/table/repairs/export', asyncHandler(controller.exportRepairsTableHandler));
analyticsRouter.get('/reports/orders/table/sales', asyncHandler(controller.getSalesTableHandler));
analyticsRouter.get('/reports/orders/table/sales/export', asyncHandler(controller.exportSalesTableHandler));
analyticsRouter.get('/reports/orders/table/procurement', asyncHandler(controller.getProcurementTableHandler));
analyticsRouter.get('/reports/orders/table/procurement/export', asyncHandler(controller.exportProcurementTableHandler));
