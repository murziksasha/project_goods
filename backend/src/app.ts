import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { env } from './config/env';
import { clientRouter } from './routes/client.routes';
import { demoRouter } from './routes/demo.routes';
import { healthRouter } from './routes/health.routes';
import { productRouter } from './routes/product.routes';
import { saleRouter } from './routes/sale.routes';
import { getErrorMessage, isDuplicateKeyError } from './shared/lib/errors';

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
app.use('/api', productRouter);
app.use('/api', clientRouter);
app.use('/api', saleRouter);
app.use('/api', demoRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode =
    error instanceof mongoose.Error.ValidationError || isDuplicateKeyError(error)
      ? 400
      : 500;
  const message = getErrorMessage(error);

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({ message });
});
