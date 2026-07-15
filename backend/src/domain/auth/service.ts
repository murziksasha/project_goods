import { Employee, type EmployeeDocument } from '../employee/model';
import {
  getEffectiveEmployeePermissions,
  type EmployeePermission,
} from '../employee/constants';
import { formatEmployee } from '../../shared/lib/formatters';
import {
  authTokenMatches,
  createAuthToken,
  hashAuthToken,
  hashPassword,
  isHashedAuthToken,
  verifyPassword,
} from '../../shared/lib/auth';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { HttpError } from '../../shared/lib/errors';
import { env } from '../../config/env';

const authProjection =
  '+passwordHash +authToken +authTokens +authSessions +inviteToken +inviteExpiresAt';
const maxActiveAuthTokens = 10;
export const MIN_PASSWORD_LENGTH = 8;
const MIN_USERNAME_LENGTH = 3;

/** Throttle lastUsedAt writes (avoid save on every request). */
export const AUTH_SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type AuthSessionRecord = {
  token: string;
  createdAt: Date;
  lastUsedAt: Date;
};

type EmployeeRecord = EmployeeDocument & {
  authSessions?: AuthSessionRecord[];
  save: () => Promise<unknown>;
  toObject: () => EmployeeDocument;
};

const toDate = (value: unknown, fallback: Date) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value) {
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
};

/** Build session list from authSessions or legacy authTokens/authToken. */
export const resolveAuthSessions = (
  employee: {
    authSessions?: Array<{ token?: string; createdAt?: Date; lastUsedAt?: Date }>;
    authTokens?: string[];
    authToken?: string;
  },
  now: Date = new Date(),
): AuthSessionRecord[] => {
  const fromSessions = (employee.authSessions ?? [])
    .map((session) => {
      const token = toNonEmptyString(session?.token);
      if (!token) return null;
      return {
        token,
        createdAt: toDate(session.createdAt, now),
        lastUsedAt: toDate(session.lastUsedAt, now),
      };
    })
    .filter((session): session is AuthSessionRecord => Boolean(session));

  if (fromSessions.length > 0) {
    return fromSessions;
  }

  const legacyTokens = [
    ...(Array.isArray(employee.authTokens) ? employee.authTokens : []),
    employee.authToken,
  ].filter(
    (item, index, items): item is string =>
      Boolean(item) && items.indexOf(item) === index,
  );

  return legacyTokens.map((token) => ({
    token,
    createdAt: now,
    lastUsedAt: now,
  }));
};

const syncLegacyAuthFields = (
  employee: EmployeeRecord,
  sessions: AuthSessionRecord[],
) => {
  employee.authSessions = sessions as EmployeeRecord['authSessions'];
  employee.authTokens = sessions.map((session) => session.token);
  employee.authToken = sessions.at(-1)?.token ?? '';
};

const idleLimitMs = () => {
  const hours = env.authSessionIdleHours;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return hours * 60 * 60 * 1000;
};

const isSessionExpired = (session: AuthSessionRecord, now: Date) => {
  const limitMs = idleLimitMs();
  if (limitMs <= 0) return false;
  return now.getTime() - session.lastUsedAt.getTime() > limitMs;
};

const findSessionForPresentedToken = (
  sessions: AuthSessionRecord[],
  presentedToken: string,
) => sessions.find((session) => authTokenMatches(presentedToken, session.token));

const createSession = async (
  employee: EmployeeRecord,
  now: Date = new Date(),
) => {
  const rawToken = createAuthToken();
  const storedToken = hashAuthToken(rawToken);
  const existing = resolveAuthSessions(employee, now).filter(
    (session) => !isSessionExpired(session, now),
  );
  const nextSessions = [
    ...existing,
    { token: storedToken, createdAt: now, lastUsedAt: now },
  ].slice(-maxActiveAuthTokens);

  syncLegacyAuthFields(employee, nextSessions);
  await employee.save();

  return {
    token: rawToken,
    employee: formatEmployee(employee.toObject()),
  };
};

const buildTokenLookupQuery = (presentedToken: string) => {
  const hashed = hashAuthToken(presentedToken);
  return {
    isActive: true,
    $or: [
      { 'authSessions.token': hashed },
      { authTokens: hashed },
      { authToken: hashed },
      // legacy plaintext sessions
      { 'authSessions.token': presentedToken },
      { authTokens: presentedToken },
      { authToken: presentedToken },
    ],
  };
};

export const loginEmployee = async (usernameValue: unknown, passwordValue: unknown) => {
  const username = toNonEmptyString(usernameValue).toLowerCase();
  const password = toNonEmptyString(passwordValue);

  if (username.length < MIN_USERNAME_LENGTH) {
    throw new HttpError(400, `Username must contain at least ${MIN_USERNAME_LENGTH} characters.`);
  }

  const employee = await Employee.findOne({
    username,
    isActive: true,
  }).select(authProjection);

  if (!employee?.passwordHash || !verifyPassword(password, employee.passwordHash)) {
    throw new HttpError(401, 'Invalid username or password.');
  }

  return createSession(employee as EmployeeRecord);
};

export const getEmployeeByToken = async (
  tokenValue: unknown,
  now: Date = new Date(),
) => {
  const token = toNonEmptyString(tokenValue);
  if (!token) {
    throw new HttpError(401, 'Authorization token is required.');
  }

  const employee = (await Employee.findOne(buildTokenLookupQuery(token)).select(
    authProjection,
  )) as EmployeeRecord | null;

  if (!employee) {
    throw new HttpError(401, 'Session not found.');
  }

  const sessions = resolveAuthSessions(employee, now);
  const session = findSessionForPresentedToken(sessions, token);
  if (!session) {
    throw new HttpError(401, 'Session not found.');
  }

  if (isSessionExpired(session, now)) {
    const remaining = sessions.filter(
      (item) => !authTokenMatches(token, item.token),
    );
    syncLegacyAuthFields(employee, remaining);
    await employee.save();
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }

  const shouldTouch =
    now.getTime() - session.lastUsedAt.getTime() >= AUTH_SESSION_TOUCH_INTERVAL_MS;
  const needsRehash = !isHashedAuthToken(session.token);
  const needsLegacySync =
    !Array.isArray(employee.authSessions) ||
    employee.authSessions.length === 0 ||
    !employee.authSessions.some((item) => authTokenMatches(token, item.token));

  if (shouldTouch || needsRehash || needsLegacySync) {
    const nextSessions = sessions.map((item) => {
      if (!authTokenMatches(token, item.token)) return item;
      return {
        token: hashAuthToken(token),
        createdAt: item.createdAt,
        lastUsedAt: shouldTouch || needsRehash ? now : item.lastUsedAt,
      };
    });
    syncLegacyAuthFields(employee, nextSessions);
    await employee.save();
  }

  return employee;
};

const getInvitationEmployee = async (tokenValue: unknown) => {
  const token = toNonEmptyString(tokenValue);
  if (!token) {
    throw new HttpError(400, 'Invitation token is required.');
  }

  const employee = await Employee.findOne({
    inviteToken: token,
    isActive: true,
  }).select(authProjection);

  if (!employee || !employee.inviteExpiresAt || employee.inviteExpiresAt.getTime() < Date.now()) {
    throw new HttpError(404, 'Invitation not found or expired.');
  }

  return employee;
};

export const getBearerToken = (authorizationHeader: unknown) => {
  const headerValue = typeof authorizationHeader === 'string' ? authorizationHeader : '';
  return headerValue.startsWith('Bearer ') ? headerValue.slice(7).trim() : '';
};

export const employeeHasPermission = (
  employee: { role?: string; permissions?: readonly string[] },
  permission: EmployeePermission,
) => {
  if (employee.role === 'owner') return true;
  return getEffectiveEmployeePermissions(employee).includes(permission);
};

export const employeeHasAnyPermission = (
  employee: { role?: string; permissions?: readonly string[] },
  permissions: readonly EmployeePermission[],
) => {
  if (employee.role === 'owner') return true;
  const effectivePermissions = getEffectiveEmployeePermissions(employee);
  return permissions.some((permission) =>
    effectivePermissions.includes(permission),
  );
};

export const getCurrentEmployee = async (tokenValue: unknown) => {
  const employee = await getEmployeeByToken(tokenValue);

  return formatEmployee(employee.toObject());
};

export const logoutEmployee = async (tokenValue: unknown) => {
  const token = toNonEmptyString(tokenValue);
  const employee = (await getEmployeeByToken(tokenValue)) as EmployeeRecord;
  const remaining = resolveAuthSessions(employee).filter(
    (session) => !authTokenMatches(token, session.token),
  );
  syncLegacyAuthFields(employee, remaining);
  await employee.save();

  return { success: true };
};

export const getInvitationDetails = async (tokenValue: unknown) => {
  const employee = await getInvitationEmployee(tokenValue);

  return {
    name: employee.name,
    email: employee.email ?? '',
    role: employee.role,
  };
};

export const acceptInvitation = async (
  tokenValue: unknown,
  usernameValue: unknown,
  passwordValue: unknown,
) => {
  const employee = await getInvitationEmployee(tokenValue);
  const username = toNonEmptyString(usernameValue).toLowerCase();
  const password = toNonEmptyString(passwordValue);

  if (username.length < MIN_USERNAME_LENGTH) {
    throw new HttpError(400, `Username must contain at least ${MIN_USERNAME_LENGTH} characters.`);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  employee.username = username;
  employee.passwordHash = hashPassword(password);
  employee.inviteToken = '';
  employee.inviteExpiresAt = null;

  await employee.save();

  return createSession(employee as EmployeeRecord);
};
