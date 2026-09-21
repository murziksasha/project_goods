import type { Request, Response } from 'express';
import {
  acceptInvitation as acceptInvitationService,
  getBearerToken,
  getCurrentEmployee,
  getInvitationDetails,
  loginEmployee,
  logoutEmployee,
} from './service';
import { updateOwnUiPreferences } from '../employee/service';
import { HttpError } from '../../shared/lib/errors';

export const login = async (req: Request, res: Response): Promise<void> => {
  res.json(await loginEmployee(req.body?.username, req.body?.password));
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  res.json(await getCurrentEmployee(getBearerToken(req.headers.authorization)));
};

export const updatePreferences = async (req: Request, res: Response): Promise<void> => {
  const employeeId = req.employee?._id?.toString();
  if (!employeeId) {
    throw new HttpError(401, 'Authentication required.');
  }
  res.json(await updateOwnUiPreferences(employeeId, req.body ?? {}));
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.json(await logoutEmployee(getBearerToken(req.headers.authorization)));
};

export const getInvitation = async (req: Request, res: Response): Promise<void> => {
  res.json(await getInvitationDetails(req.params.token));
};

export const registerWithInvitation = async (req: Request, res: Response): Promise<void> => {
  res.json(await acceptInvitationService(req.params.token, req.body?.username, req.body?.password));
};

