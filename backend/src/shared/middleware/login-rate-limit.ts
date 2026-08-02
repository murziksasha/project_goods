import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../lib/errors';

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 40;
const MAX_ATTEMPTS_PER_USERNAME = 15;

const ipBuckets = new Map<string, Bucket>();
const usernameBuckets = new Map<string, Bucket>();

const touch = (map: Map<string, Bucket>, key: string, max: number, now: number) => {
  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    const next: Bucket = { count: 1, resetAt: now + WINDOW_MS };
    map.set(key, next);
    return next;
  }
  existing.count += 1;
  return existing;
};

const isOverLimit = (bucket: Bucket, max: number, now: number) =>
  bucket.resetAt > now && bucket.count > max;

const clientIp = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

/** Soft login throttle for LAN: limits brute-force without affecting other API routes. */
export const loginRateLimit: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const now = Date.now();
  const ip = clientIp(req);
  const username =
    typeof req.body?.username === 'string'
      ? req.body.username.trim().toLowerCase()
      : '';

  const ipBucket = touch(ipBuckets, ip, MAX_ATTEMPTS_PER_IP, now);
  if (isOverLimit(ipBucket, MAX_ATTEMPTS_PER_IP, now)) {
    next(
      new HttpError(
        429,
        'Too many login attempts from this address. Try again later.',
      ),
    );
    return;
  }

  if (username) {
    const userBucket = touch(usernameBuckets, username, MAX_ATTEMPTS_PER_USERNAME, now);
    if (isOverLimit(userBucket, MAX_ATTEMPTS_PER_USERNAME, now)) {
      next(
        new HttpError(
          429,
          'Too many login attempts for this user. Try again later.',
        ),
      );
      return;
    }
  }

  next();
};

/** Test helper: clear in-memory buckets between unit tests. */
export const resetLoginRateLimitState = () => {
  ipBuckets.clear();
  usernameBuckets.clear();
};
