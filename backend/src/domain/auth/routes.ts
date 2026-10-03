import { Router } from 'express';
import { asyncHandler } from '../../shared/lib/http';
import { loginRateLimit } from '../../shared/middleware/login-rate-limit';
import * as controller from './controller';

export const authRouter = Router();

authRouter.post('/auth/login', loginRateLimit, asyncHandler(controller.login));
authRouter.get('/auth/me', asyncHandler(controller.getCurrentUser));
authRouter.patch('/auth/me/preferences', asyncHandler(controller.updatePreferences));
authRouter.post('/auth/logout', asyncHandler(controller.logout));
authRouter.get('/auth/invitations/:token', asyncHandler(controller.getInvitation));
authRouter.post('/auth/invitations/:token/register', asyncHandler(controller.registerWithInvitation));

