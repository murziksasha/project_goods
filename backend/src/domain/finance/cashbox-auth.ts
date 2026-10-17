import { HttpError } from '../../shared/lib/errors';

export interface EmployeeCashboxActor {
  role?: string;
  allowedCashboxIds?: string[];
}

export const assertEmployeeCanTransactWithCashbox = (
  actor: EmployeeCashboxActor | null | undefined,
  cashboxId: string,
): void => {
  if (!actor || actor.role === 'owner') {
    return;
  }
  const allowed = Array.isArray(actor.allowedCashboxIds) ? actor.allowedCashboxIds : [];
  if (!allowed.includes(cashboxId)) {
    throw new HttpError(403, 'Forbidden: cashbox access denied');
  }
};

