import { describe, expect, it } from 'vitest';
import { describeErrorSafely, redactMongoCredentials } from './redact-mongo-credentials';

describe('redactMongoCredentials', () => {
  it('masks credentials in standard and SRV MongoDB URIs embedded in errors', () => {
    expect(
      redactMongoCredentials(
        'failed mongodb://app-user:secret%40value@mongo:27017/inventory and mongodb+srv://backup:other-secret@cluster.example/inventory',
      ),
    ).toBe(
      'failed mongodb://[REDACTED]@mongo:27017/inventory and mongodb+srv://[REDACTED]@cluster.example/inventory',
    );
  });

  it('masks the whole password when it contains an unencoded @', () => {
    const redacted = redactMongoCredentials(
      'connect failed: mongodb://app:p@ss@word@mongo:27017/inventory?authSource=inventory',
    );
    expect(redacted).toBe(
      'connect failed: mongodb://[REDACTED]@mongo:27017/inventory?authSource=inventory',
    );
    expect(redacted).not.toContain('ss@word');
  });

  it('keeps stack traces while masking credentials', () => {
    const error = new Error('bad mongodb://u:secret@mongo:27017/inventory');
    const described = describeErrorSafely(error);
    expect(described).toContain('mongodb://[REDACTED]@mongo:27017/inventory');
    expect(described).not.toContain('secret');
    expect(describeErrorSafely('mongodb://u:secret@h/db')).toBe('mongodb://[REDACTED]@h/db');
  });

  it('leaves credential-free connection strings intact', () => {
    expect(redactMongoCredentials('mongodb://mongo:27017/inventory')).toBe(
      'mongodb://mongo:27017/inventory',
    );
  });
});
