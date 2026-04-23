import type { Employee } from '../../employee/model/types';

export type AuthSession = {
  token: string;
  employee: Employee;
};

export type LoginPayload = {
  username: string;
  password: string;
};
