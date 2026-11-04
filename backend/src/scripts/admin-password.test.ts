import { describe, expect, it } from 'vitest';
import { requireAdminPassword } from './admin-password';

describe('requireAdminPassword', () => {
  it('fails before connecting when the password is missing or too short', () => {
    expect(() => requireAdminPassword(undefined)).toThrow('PROJECT_GOODS_ADMIN_PASSWORD');
    expect(() => requireAdminPassword('admin')).toThrow('at least 8 characters');
    expect(() => requireAdminPassword('        ')).toThrow('at least 8 characters');
  });

  it('retains the supplied password without logging or rewriting it', () => {
    expect(requireAdminPassword(' secure-passphrase ')).toBe(' secure-passphrase ');
  });
});
