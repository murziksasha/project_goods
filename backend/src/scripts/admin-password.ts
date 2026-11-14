import { MIN_PASSWORD_LENGTH } from '../domain/auth/service';

export const requireAdminPassword = (value: string | undefined): string => {
  if (!value || value.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `PROJECT_GOODS_ADMIN_PASSWORD must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  return value;
};
