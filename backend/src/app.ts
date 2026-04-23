import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { env } from './config/env';
import { clientRouter } from './routes/client.routes';
import { authRouter } from './routes/auth.routes';
import { demoRouter } from './routes/demo.routes';
import { employeeRouter } from './routes/employee.routes';
import { financeRouter } from './routes/finance.routes';
import { healthRouter } from './routes/health.routes';
import { productRouter } from './routes/product.routes';
import { saleRouter } from './routes/sale.routes';
import { serviceCatalogRouter } from './routes/service-catalog.routes';
import { settingsRouter } from './routes/settings.routes';
import { HttpError, getErrorMessage, isDuplicateKeyError } from './shared/lib/errors';

export const app = express();

app.use(
  cors({
    origin: env.clientOrigin
      ? env.clientOrigin.split(',').map((origin) => origin.trim())
      : true,
  }),
);
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', productRouter);
app.use('/api', clientRouter);
app.use('/api', saleRouter);
app.use('/api', serviceCatalogRouter);
app.use('/api', demoRouter);
app.use('/api', employeeRouter);
app.use('/api', settingsRouter);
app.use('/api', financeRouter);

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
