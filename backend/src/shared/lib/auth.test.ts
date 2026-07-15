import { describe, expect, it } from 'vitest';
import {
  authTokenMatches,
  createAuthToken,
  hashAuthToken,
  hashPassword,
  isHashedAuthToken,
  verifyPassword,
} from './auth';

describe('auth crypto', () => {
  it('hashes and verifies passwords', () => {
    const hash = hashPassword('secret-pass');
    expect(verifyPassword('secret-pass', hash)).toBe(true);
    expect(verifyPassword('wrong-pass', hash)).toBe(false);
  });

  it('creates random auth tokens', () => {
    expect(createAuthToken()).toHaveLength(64);
    expect(createAuthToken()).not.toBe(createAuthToken());
  });

  it('hashes tokens with version prefix', () => {
    const token = createAuthToken();
    const hashed = hashAuthToken(token);
    expect(isHashedAuthToken(hashed)).toBe(true);
    expect(hashed).not.toBe(token);
    expect(authTokenMatches(token, hashed)).toBe(true);
    expect(authTokenMatches('other', hashed)).toBe(false);
  });

  it('matches legacy plaintext tokens', () => {
    const token = 'legacy-plaintext-token-value';
    expect(authTokenMatches(token, token)).toBe(true);
    expect(authTokenMatches(token, 'other')).toBe(false);
  });
});
