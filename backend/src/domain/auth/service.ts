import { Employee } from '../employee/model';
import { formatEmployee } from '../../shared/lib/formatters';
import { createAuthToken, hashPassword, verifyPassword } from '../../shared/lib/auth';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { HttpError } from '../../shared/lib/errors';

const authProjection = '+passwordHash +authToken +inviteToken +inviteExpiresAt';

const createSession = async (employee: any) => {
  employee.authToken = createAuthToken();
  await employee.save();

  return {
    token: employee.authToken,
    employee: formatEmployee(employee.toObject()),
  };
};

export const loginEmployee = async (usernameValue: unknown, passwordValue: unknown) => {
  const username = toNonEmptyString(usernameValue).toLowerCase();
  const password = toNonEmptyString(passwordValue);

  if (username.length < 3) {
    throw new HttpError(400, 'Username must contain at least 3 characters.');
  }

  if (password.length < 3) {
    throw new HttpError(400, 'Password must contain at least 3 characters.');
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
    authToken: token,
    isActive: true,
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

export const getCurrentEmployee = async (tokenValue: unknown) => {
  const employee = await getEmployeeByToken(tokenValue);

  return formatEmployee(employee.toObject());
};

export const logoutEmployee = async (tokenValue: unknown) => {
  const employee = await getEmployeeByToken(tokenValue);
  employee.authToken = '';
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

  if (username.length < 3) {
    throw new HttpError(400, 'Username must contain at least 3 characters.');
  }

  if (password.length < 3) {
    throw new HttpError(400, 'Password must contain at least 3 characters.');
  }

  employee.username = username;
  employee.passwordHash = hashPassword(password);
  employee.inviteToken = '';
  employee.inviteExpiresAt = null;

  await employee.save();

  return createSession(employee);
};
