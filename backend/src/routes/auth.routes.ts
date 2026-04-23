import { Router } from 'express';
import { getCurrentEmployee, loginEmployee, logoutEmployee } from '../domain/auth/service';

const getBearerToken = (authorizationHeader: unknown) => {
  const headerValue = typeof authorizationHeader === 'string' ? authorizationHeader : '';
  return headerValue.startsWith('Bearer ') ? headerValue.slice(7).trim() : '';
};

export const authRouter = Router();

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    res.json(await loginEmployee(req.body?.username, req.body?.password));
  } catch (error) {
    next(error);
  }
});

authRouter.get('/auth/me', async (req, res, next) => {
  try {
    res.json(await getCurrentEmployee(getBearerToken(req.headers.authorization)));
  } catch (error) {
    next(error);
  }
});

authRouter.post('/auth/logout', async (req, res, next) => {
  try {
    res.json(await logoutEmployee(getBearerToken(req.headers.authorization)));
  } catch (error) {
    next(error);
  }
});
