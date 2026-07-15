import { Employee, type EmployeeDocument } from '../employee/model';
import {
  getEffectiveEmployeePermissions,
  type EmployeePermission,
} from '../employee/constants';
import { formatEmployee } from '../../shared/lib/formatters';
import { createAuthToken, hashPassword, verifyPassword } from '../../shared/lib/auth';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { HttpError } from '../../shared/lib/errors';

const authProjection =
  '+passwordHash +authToken +authTokens +inviteToken +inviteExpiresAt';
const maxActiveAuthTokens = 10;
export const MIN_PASSWORD_LENGTH = 8;
const MIN_USERNAME_LENGTH = 3;

type EmployeeRecord = EmployeeDocument & {
  save: () => Promise<unknown>;
  toObject: () => EmployeeDocument;
};

const createSession = async (employee: EmployeeRecord) => {
  const token = createAuthToken();
  const existingTokens = [
    ...(Array.isArray(employee.authTokens) ? employee.authTokens : []),
    employee.authToken,
  ].filter(
    (item, index, items): item is string =>
      Boolean(item) && item !== token && items.indexOf(item) === index,
  );
  employee.authTokens = [...existingTokens, token].slice(-maxActiveAuthTokens);
  employee.authToken = token;
  await employee.save();

  return {
    token,
    employee: formatEmployee(employee.toObject()),
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

  return createSession(employee);
};

export const getEmployeeByToken = async (tokenValue: unknown) => {
  const token = toNonEmptyString(tokenValue);
  if (!token) {
    throw new HttpError(401, 'Authorization token is required.');
  }

  const employee = await Employee.findOne({
    isActive: true,
    $or: [{ authTokens: token }, { authToken: token }],
  }).select(authProjection);

  if (!employee) {
    throw new HttpError(401, 'Session not found.');
  }

  return employee;
};

export const requireOwnerByToken = async (tokenValue: unknown) => {
  const employee = await getEmployeeByToken(tokenValue);
  if (employee.role !== 'owner') {
    throw new HttpError(403, 'Only owners can manage employees.');
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

export const requirePermissionByToken = async (
  tokenValue: unknown,
  permission: EmployeePermission,
  message = 'Current employee does not have required permission.',
) => {
  const employee = await getEmployeeByToken(tokenValue);
  if (!employeeHasPermission(employee, permission)) {
    throw new HttpError(403, message);
  }

  return employee;
};

export const requireAnyPermissionByToken = async (
  tokenValue: unknown,
  permissions: readonly EmployeePermission[],
  message = 'Current employee does not have required permission.',
) => {
  const employee = await getEmployeeByToken(tokenValue);
  if (!employeeHasAnyPermission(employee, permissions)) {
    throw new HttpError(403, message);
  }

  return employee;
};

export const getCurrentEmployee = async (tokenValue: unknown) => {
  const employee = await getEmployeeByToken(tokenValue);

  return formatEmployee(employee.toObject());
};

export const logoutEmployee = async (tokenValue: unknown) => {
  const token = toNonEmptyString(tokenValue);
  const employee = await getEmployeeByToken(tokenValue);
  employee.authTokens = (employee.authTokens ?? []).filter(
    (storedToken) => storedToken !== token,
  );
  if (employee.authToken === token) {
    employee.authToken = employee.authTokens.at(-1) ?? '';
  }
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

  return createSession(employee);
};
