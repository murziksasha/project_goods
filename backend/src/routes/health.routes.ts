import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

const getBuildSha = () =>
  process.env.BUILD_SHA?.trim() ||
  process.env.GIT_SHA?.trim() ||
  process.env.VITE_BUILD_SHA?.trim() ||
  'dev';

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mongoReadyState: mongoose.connection.readyState,
    version: process.env.npm_package_version ?? '1.0.0',
    buildSha: getBuildSha(),
  });
});
