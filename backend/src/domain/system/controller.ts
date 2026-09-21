import type { Request, Response } from 'express';
import mongoose from 'mongoose';

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

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
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

  res.status(200).json(payload);
};

