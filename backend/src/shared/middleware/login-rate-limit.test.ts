import { EventEmitter } from 'node:events';
import type { Request, RequestHandler, Response } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseEnv } from '../../config/env';
import { HttpError } from '../lib/errors';
import {
  createLoginRateLimit,
  DEFAULT_MAX_FAILED_LOGINS_PER_IP,
  loginRateLimit,
  resetLoginRateLimitState,
} from './login-rate-limit';

/**
 * Runs the middleware; if it passes the request on, the simulated login handler
 * finishes the response with `outcomeStatus` (200 = success, 401 = bad password).
 */
const run = (
  body: { username?: string } = {},
  ip = '10.0.0.1',
  outcomeStatus = 200,
  forwarded = '',
  middleware: RequestHandler = loginRateLimit,
) =>
  new Promise<unknown>((resolve) => {
    const req = {
      body,
      ip,
      headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
      socket: { remoteAddress: ip },
    } as unknown as Request;
    const res = Object.assign(new EventEmitter(), { statusCode: 200 }) as unknown as Response;
    middleware(req, res, (error?: unknown) => {
      if (!error) {
        res.statusCode = outcomeStatus;
        (res as unknown as EventEmitter).emit('finish');
      }
      resolve(error);
    });
  });

const expect429 = (error: unknown) => {
  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).statusCode).toBe(429);
};

describe('loginRateLimit', () => {
  beforeEach(() => {
    resetLoginRateLimitState();
  });

  it('allows normal login volume', async () => {
    for (let i = 0; i < 10; i += 1) {
      await expect(run({ username: 'owner' })).resolves.toBeUndefined();
    }
  });

  it('blocks after too many attempts for the same username', async () => {
    for (let i = 0; i < 15; i += 1) {
      await expect(run({ username: 'admin' })).resolves.toBeUndefined();
    }
    expect429(await run({ username: 'admin' }));
  });

  it('tracks usernames case-insensitively', async () => {
    for (let i = 0; i < 15; i += 1) {
      await expect(run({ username: 'Admin' })).resolves.toBeUndefined();
    }
    expect429(await run({ username: 'ADMIN' }));
  });

  it('does not count successful logins toward the shared IP limit', async () => {
    // Docker Desktop: whole shop arrives from one gateway address.
    for (let i = 0; i < 300; i += 1) {
      await expect(run({ username: `user-${i % 50}-${Math.floor(i / 50)}` }, '172.18.0.1', 200)).resolves.toBeUndefined();
    }
  });

  it('blocks an IP after the default number of failed logins', async () => {
    expect(DEFAULT_MAX_FAILED_LOGINS_PER_IP).toBe(100);
    for (let i = 0; i < 100; i += 1) {
      await expect(run({ username: `user-${i}` }, '10.0.0.9', 401)).resolves.toBeUndefined();
    }
    expect429(await run({ username: 'another' }, '10.0.0.9', 200));
    // Other addresses are unaffected.
    await expect(run({ username: 'another' }, '10.0.0.10', 200)).resolves.toBeUndefined();
  });

  it('41+ failures from one user do not block other users on the same IP', async () => {
    for (let i = 0; i < 15; i += 1) {
      await expect(run({ username: 'guesser' }, '172.18.0.1', 401)).resolves.toBeUndefined();
    }
    for (let i = 0; i < 30; i += 1) {
      expect429(await run({ username: 'guesser' }, '172.18.0.1', 401));
    }
    for (let i = 0; i < 20; i += 1) {
      await expect(run({ username: `cashier-${i}` }, '172.18.0.1', 200)).resolves.toBeUndefined();
    }
  });

  it('does not count its own 429 rejections as failures', async () => {
    const limiter = createLoginRateLimit({ maxFailedPerIp: 3 });
    for (let i = 0; i < 3; i += 1) {
      await expect(run({ username: `u${i}` }, '10.0.0.5', 401, '', limiter)).resolves.toBeUndefined();
    }
    for (let i = 0; i < 5; i += 1) {
      expect429(await run({ username: `x${i}` }, '10.0.0.5', 200, '', limiter));
    }
  });

  it('honours a configured per-IP failure limit', async () => {
    const limiter = createLoginRateLimit({ maxFailedPerIp: 5 });
    for (let i = 0; i < 5; i += 1) {
      await expect(run({ username: `u${i}` }, '10.0.0.7', 401, '', limiter)).resolves.toBeUndefined();
    }
    expect429(await run({ username: 'u-next' }, '10.0.0.7', 200, '', limiter));
  });

  it('ignores a spoofed forwarding header when Express resolves the client IP', async () => {
    for (let i = 0; i < 100; i += 1) {
      await expect(
        run({ username: `user-${i}` }, '10.0.0.9', 401, `203.0.113.${(i % 250) + 1}`),
      ).resolves.toBeUndefined();
    }
    expect429(await run({ username: 'another' }, '10.0.0.9', 200, '203.0.113.250'));
  });
});

describe('LOGIN_MAX_FAILED_PER_IP env', () => {
  it('defaults to 100 and accepts a positive override', () => {
    expect(parseEnv({}).loginMaxFailedPerIp).toBe(100);
    expect(parseEnv({ LOGIN_MAX_FAILED_PER_IP: '250' }).loginMaxFailedPerIp).toBe(250);
    expect(parseEnv({ LOGIN_MAX_FAILED_PER_IP: '0' }).loginMaxFailedPerIp).toBe(100);
    expect(parseEnv({ LOGIN_MAX_FAILED_PER_IP: 'abc' }).loginMaxFailedPerIp).toBe(100);
  });
});
