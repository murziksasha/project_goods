// Greedy up to the last `@` of the authority, so an unencoded `@` inside a password
// cannot leave the tail of the password visible.
const mongoCredentialsPattern = /(mongodb(?:\+srv)?:\/\/)[^\s/?#]*@/gi;

/** Mask credentials in MongoDB URIs before errors reach logs, metadata, or clients. */
export const redactMongoCredentials = (value: string): string =>
  value.replace(mongoCredentialsPattern, '$1[REDACTED]@');

/** Error-to-string helper for logs: keeps the stack when available and masks Mongo credentials. */
export const describeErrorSafely = (error: unknown): string =>
  redactMongoCredentials(
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
