import { Router } from 'express';
import {
  acceptInvitation,
  getBearerToken,
  getCurrentEmployee,
  getInvitationDetails,
  loginEmployee,
  logoutEmployee,
} from '../domain/auth/service';
import { asyncHandler } from '../shared/lib/http';

export const authRouter = Router();

authRouter.post('/auth/login', asyncHandler(async (req, res) => {
  res.json(await loginEmployee(req.body?.username, req.body?.password));
}));

authRouter.get('/auth/me', asyncHandler(async (req, res) => {
  res.json(await getCurrentEmployee(getBearerToken(req.headers.authorization)));
}));

authRouter.post('/auth/logout', asyncHandler(async (req, res) => {
  res.json(await logoutEmployee(getBearerToken(req.headers.authorization)));
}));

authRouter.get('/auth/invitations/:token', asyncHandler(async (req, res) => {
  res.json(await getInvitationDetails(req.params.token));
}));

authRouter.post('/auth/invitations/:token/register', asyncHandler(async (req, res) => {
  res.json(await acceptInvitation(req.params.token, req.body?.username, req.body?.password));
}));
