import { describe, expect, it } from 'vitest';
import { redactMongoCredentials } from './redact-mongo-credentials';

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

  it('leaves credential-free connection strings intact', () => {
    expect(redactMongoCredentials('mongodb://mongo:27017/inventory')).toBe(
      'mongodb://mongo:27017/inventory',
    );
  });
});
