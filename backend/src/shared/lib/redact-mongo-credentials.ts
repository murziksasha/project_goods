const mongoCredentialsPattern = /(mongodb(?:\+srv)?:\/\/)[^\s/?#@]+@/gi;

/** Mask credentials in MongoDB URIs before errors reach logs, metadata, or clients. */
export const redactMongoCredentials = (value: string): string =>
  value.replace(mongoCredentialsPattern, '$1[REDACTED]@');
