import type { Employee } from '../../employee/model/types';

export type AuthSession = {
  token: string;
  employee: Employee;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type InvitationDetails = {
  name: string;
  email: string;
  role: string;
};
