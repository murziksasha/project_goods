import crypto from 'crypto';

const passwordKeyLength = 64;

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
