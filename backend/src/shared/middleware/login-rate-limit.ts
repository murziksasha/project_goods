import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { env } from '../../config/env';
import { HttpError } from '../lib/errors';

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_MAX_FAILED_LOGINS_PER_IP = 100;
const MAX_ATTEMPTS_PER_USERNAME = 15;

const ipFailureBuckets = new Map<string, Bucket>();
const usernameBuckets = new Map<string, Bucket>();

const touch = (map: Map<string, Bucket>, key: string, now: number) => {
  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    const next: Bucket = { count: 1, resetAt: now + WINDOW_MS };
    map.set(key, next);
    return next;
  }
  existing.count += 1;
  return existing;
};

const currentCount = (map: Map<string, Bucket>, key: string, now: number) => {
  const existing = map.get(key);
  return existing && existing.resetAt > now ? existing.count : 0;
};

const clientIp = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown';

export type LoginRateLimitOptions = {
  /** Failed login responses allowed per client IP within the window before 429. */
  maxFailedPerIp?: number;
};

/**
 * Soft login throttle for LAN: limits brute-force without affecting other API routes.
 *
 * - Per IP: only FAILED logins (final status >= 400, except our own 429) are counted.
 *   Docker Desktop may present every LAN client as one gateway address, so counting
 *   successful logins would make the whole shop share one budget.
 * - Per username: every attempt is counted (15 per window), unchanged.
 */
export const createLoginRateLimit = (
  options: LoginRateLimitOptions = {},
): RequestHandler => {
  const maxFailedPerIp =
    options.maxFailedPerIp ?? env.loginMaxFailedPerIp ?? DEFAULT_MAX_FAILED_LOGINS_PER_IP;

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = clientIp(req);
    const username =
      typeof req.body?.username === 'string'
        ? req.body.username.trim().toLowerCase()
        : '';

    if (currentCount(ipFailureBuckets, ip, now) >= maxFailedPerIp) {
      next(
        new HttpError(
          429,
          'Too many failed login attempts from this address. Try again later.',
        ),
      );
      return;
    }

    if (username) {
      const userBucket = touch(usernameBuckets, username, now);
      if (userBucket.count > MAX_ATTEMPTS_PER_USERNAME) {
        next(
          new HttpError(
            429,
            'Too many login attempts for this user. Try again later.',
          ),
        );
        return;
      }
    }

    res.once('finish', () => {
      if (res.statusCode >= 400 && res.statusCode !== 429) {
        touch(ipFailureBuckets, ip, Date.now());
      }
    });

    next();
  };
};

export const loginRateLimit: RequestHandler = createLoginRateLimit();

/** Test helper: clear in-memory buckets between unit tests. */
export const resetLoginRateLimitState = () => {
  ipFailureBuckets.clear();
  usernameBuckets.clear();
};
