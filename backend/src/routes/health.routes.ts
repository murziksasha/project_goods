import { Router } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../shared/lib/http';

export const healthRouter = Router();

const getBuildSha = () =>
  process.env.BUILD_SHA?.trim() ||
  process.env.GIT_SHA?.trim() ||
  process.env.VITE_BUILD_SHA?.trim() ||
  'dev';

const pingMongo = async () => {
  const started = Date.now();
  const readyState = mongoose.connection.readyState;
  if (readyState !== 1 || !mongoose.connection.db) {
    return {
      ok: false as const,
      readyState,
      latencyMs: null as number | null,
    };
  }

  try {
    await mongoose.connection.db.admin().command({ ping: 1 });
    return {
      ok: true as const,
      readyState,
      latencyMs: Date.now() - started,
    };
  } catch {
    return {
      ok: false as const,
      readyState,
      latencyMs: Date.now() - started,
    };
  }
};

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const mongo = await pingMongo();
    const status = mongo.ok ? 'ok' : 'degraded';
    const payload = {
      status,
      mongoReadyState: mongo.readyState,
      mongoOk: mongo.ok,
      mongoLatencyMs: mongo.latencyMs,
      version: process.env.npm_package_version ?? '1.0.0',
      buildSha: getBuildSha(),
    };

    // Still 200 for load balancers that only check HTTP success; body.status = degraded
    // when Mongo is unreachable. Use mongoOk for strict probes.
    res.status(200).json(payload);
  }),
);
