import crypto from 'crypto';

const passwordKeyLength = 64;
const AUTH_TOKEN_HASH_PREFIX = 'h1:';

export const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, passwordKeyLength).toString('hex');

  return `${salt}:${hash}`;
};

export const verifyPassword = (password: string, passwordHash: string) => {
  const [salt, storedHash] = passwordHash.split(':');
  if (!salt || !storedHash) {
    return false;
  }

  const computedHash = crypto.scryptSync(password, salt, passwordKeyLength);
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (storedBuffer.length !== computedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, computedHash);
};

export const createAuthToken = () => crypto.randomBytes(32).toString('hex');

/** SHA-256 with version prefix — high-entropy tokens need no salt. */
export const hashAuthToken = (token: string) =>
  `${AUTH_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token, 'utf8').digest('hex')}`;

export const isHashedAuthToken = (value: string) =>
  value.startsWith(AUTH_TOKEN_HASH_PREFIX);

export const authTokenMatches = (presented: string, stored: string) => {
  if (!presented || !stored) return false;

  if (isHashedAuthToken(stored)) {
    const expected = hashAuthToken(presented);
    const expectedBuf = Buffer.from(expected, 'utf8');
    const storedBuf = Buffer.from(stored, 'utf8');
    if (expectedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, storedBuf);
  }

  // Legacy plaintext sessions (pre-hash migration)
  const presentedBuf = Buffer.from(presented, 'utf8');
  const storedBuf = Buffer.from(stored, 'utf8');
  if (presentedBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(presentedBuf, storedBuf);
};
