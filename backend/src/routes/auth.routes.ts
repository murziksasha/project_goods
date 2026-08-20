import { Router } from 'express';
import {
  acceptInvitation,
  getBearerToken,
  getCurrentEmployee,
  getInvitationDetails,
  loginEmployee,
  logoutEmployee,
} from '../domain/auth/service';
import { updateOwnUiPreferences } from '../domain/employee/service';
import { HttpError } from '../shared/lib/errors';
import { asyncHandler } from '../shared/lib/http';
import { loginRateLimit } from '../shared/middleware/login-rate-limit';

export const authRouter = Router();

authRouter.post(
  '/auth/login',
  loginRateLimit,
  asyncHandler(async (req, res) => {
    res.json(await loginEmployee(req.body?.username, req.body?.password));
  }),
);

authRouter.get('/auth/me', asyncHandler(async (req, res) => {
  res.json(await getCurrentEmployee(getBearerToken(req.headers.authorization)));
}));

authRouter.patch(
  '/auth/me/preferences',
  asyncHandler(async (req, res) => {
    const employeeId = req.employee?._id?.toString();
    if (!employeeId) {
      throw new HttpError(401, 'Authentication required.');
    }
    res.json(await updateOwnUiPreferences(employeeId, req.body ?? {}));
  }),
);

authRouter.post('/auth/logout', asyncHandler(async (req, res) => {
  res.json(await logoutEmployee(getBearerToken(req.headers.authorization)));
}));

authRouter.get('/auth/invitations/:token', asyncHandler(async (req, res) => {
  res.json(await getInvitationDetails(req.params.token));
}));

authRouter.post('/auth/invitations/:token/register', asyncHandler(async (req, res) => {
  res.json(await acceptInvitation(req.params.token, req.body?.username, req.body?.password));
}));
