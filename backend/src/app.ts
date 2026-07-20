import './types/express-augment';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env';
import { requireAuthUnlessPublic } from './shared/middleware/auth';
import { clientRouter } from './routes/client.routes';
import { authRouter } from './routes/auth.routes';
import { backupRouter } from './routes/backup.routes';
import { demoRouter } from './routes/demo.routes';
import { employeeRouter } from './routes/employee.routes';
import { financeRouter } from './routes/finance.routes';
import { healthRouter } from './routes/health.routes';
import { productRouter } from './routes/product.routes';
import { saleRouter } from './routes/sale.routes';
import { serviceCatalogRouter } from './routes/service-catalog.routes';
import { settingsRouter } from './routes/settings.routes';
import { supplierRouter } from './routes/supplier.routes';
import { clientDeviceRouter } from './routes/client-device.routes';
import { catalogProductRouter } from './routes/catalog-product.routes';
import { supplierOrderRouter } from './routes/supplier-order.routes';
import { warehouseSettingsRouter } from './routes/warehouse-settings.routes';
import { marketRouter } from './routes/market.routes';
import { weatherRouter } from './routes/weather.routes';
import { HttpError, getErrorMessage, isDuplicateKeyError } from './shared/lib/errors';

export const app = express();

app.use(helmet());

const resolvedCorsOrigin = env.clientOrigin
  ? env.clientOrigin.split(',').map((origin) => origin.trim()).filter(Boolean)
  : null;

if (!resolvedCorsOrigin && process.env.NODE_ENV === 'production') {
  console.warn(
    'CLIENT_ORIGIN is not set; browser cross-origin requests will be blocked in production.',
  );
}

app.use(
  cors({
    // Production without CLIENT_ORIGIN: deny reflected origins. Dev: allow all.
    origin: resolvedCorsOrigin ?? (process.env.NODE_ENV === 'production' ? false : true),
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use('/api', requireAuthUnlessPublic);
app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', backupRouter);
app.use('/api', productRouter);
app.use('/api', clientRouter);
app.use('/api', saleRouter);
app.use('/api', serviceCatalogRouter);
app.use('/api', demoRouter);
app.use('/api', employeeRouter);
app.use('/api', settingsRouter);
app.use('/api', financeRouter);
app.use('/api', supplierRouter);
app.use('/api', clientDeviceRouter);
app.use('/api', catalogProductRouter);
app.use('/api', supplierOrderRouter);
app.use('/api', warehouseSettingsRouter);
app.use('/api', marketRouter);
app.use('/api', weatherRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode =
    error instanceof HttpError
      ? error.statusCode
      : 
    error instanceof mongoose.Error.ValidationError || isDuplicateKeyError(error)
      ? 400
      : 500;
  const message = getErrorMessage(error);

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({ message });
});
