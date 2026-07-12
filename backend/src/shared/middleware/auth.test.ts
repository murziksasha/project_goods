import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { isPublicApiRoute } from './auth';

const createRequest = (method: string, path: string): Request =>
  ({ method, path }) as Request;

describe('isPublicApiRoute', () => {
  it('allows health checks without auth', () => {
    expect(isPublicApiRoute(createRequest('GET', '/health'))).toBe(true);
  });

  it('allows login without auth', () => {
    expect(isPublicApiRoute(createRequest('POST', '/auth/login'))).toBe(true);
  });

  it('allows invitation lookup without auth', () => {
    expect(isPublicApiRoute(createRequest('GET', '/auth/invitations/abc123'))).toBe(true);
  });

  it('allows invitation registration without auth', () => {
    expect(
      isPublicApiRoute(createRequest('POST', '/auth/invitations/abc123/register')),
    ).toBe(true);
  });

  it('requires auth for protected routes', () => {
    expect(isPublicApiRoute(createRequest('GET', '/products'))).toBe(false);
    expect(isPublicApiRoute(createRequest('GET', '/auth/me'))).toBe(false);
    expect(isPublicApiRoute(createRequest('POST', '/demo/seed'))).toBe(false);
  });
});