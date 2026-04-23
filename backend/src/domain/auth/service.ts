import { Employee, type EmployeeDocument } from '../employee/model';
import { formatEmployee } from '../../shared/lib/formatters';
import { createAuthToken, verifyPassword } from '../../shared/lib/auth';
import { toNonEmptyString } from '../../shared/lib/parsers';

const authProjection = '+passwordHash +authToken';

export const loginEmployee = async (usernameValue: unknown, passwordValue: unknown) => {
  const username = toNonEmptyString(usernameValue).toLowerCase();
  const password = toNonEmptyString(passwordValue);

  if (username.length < 3) {
    throw new Error('Username must contain at least 3 characters.');
  }

  if (password.length < 4) {
    throw new Error('Password must contain at least 4 characters.');
  }

  const employee = await Employee.findOne({
    username,
    isActive: true,
  }).select(authProjection);

  if (!employee || !verifyPassword(password, employee.passwordHash)) {
    throw new Error('Invalid username or password.');
  }

  employee.authToken = createAuthToken();
  await employee.save();

  return {
    token: employee.authToken,
    employee: formatEmployee(employee.toObject<EmployeeDocument>()),
  };
};

export const getEmployeeByToken = async (tokenValue: unknown) => {
  const token = toNonEmptyString(tokenValue);
  if (!token) {
    throw new Error('Authorization token is required.');
  }

  const employee = await Employee.findOne({
    authToken: token,
    isActive: true,
  }).select(authProjection);

  if (!employee) {
    throw new Error('Session not found.');
  }

  return employee;
};

export const getCurrentEmployee = async (tokenValue: unknown) => {
  const employee = await getEmployeeByToken(tokenValue);

  return formatEmployee(employee.toObject<EmployeeDocument>());
};

export const logoutEmployee = async (tokenValue: unknown) => {
  const employee = await getEmployeeByToken(tokenValue);
  employee.authToken = '';
  await employee.save();

  return { success: true };
};
