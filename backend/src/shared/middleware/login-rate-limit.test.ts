import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { HttpError } from '../lib/errors';
import { loginRateLimit, resetLoginRateLimitState } from './login-rate-limit';

const run = (body: { username?: string } = {}, ip = '10.0.0.1') =>
  new Promise<unknown>((resolve) => {
    const req = {
      body,
      ip,
      headers: {},
      socket: { remoteAddress: ip },
    } as unknown as Request;
    const res = {} as Response;
    loginRateLimit(req, res, (error?: unknown) => resolve(error));
  });

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
    const error = await run({ username: 'admin' });
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).statusCode).toBe(429);
  });

  it('blocks after too many attempts from the same IP', async () => {
    for (let i = 0; i < 40; i += 1) {
      await expect(run({ username: `user-${i}` }, '10.0.0.9')).resolves.toBeUndefined();
    }
    const error = await run({ username: 'another' }, '10.0.0.9');
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).statusCode).toBe(429);
  });

  it('tracks usernames case-insensitively', async () => {
    for (let i = 0; i < 15; i += 1) {
      await expect(run({ username: 'Admin' })).resolves.toBeUndefined();
    }
    const error = await run({ username: 'ADMIN' });
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).statusCode).toBe(429);
  });
});
