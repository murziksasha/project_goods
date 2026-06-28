import { useCallback, useState } from 'react';
import i18n from '../../../../shared/i18n/config';

type FinanceActionOptions = {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  refresh?: () => Promise<void>;
};

export type RunFinanceActionOptions<T> = {
  afterSuccess?: (result: T) => void | Promise<void>;
  errorFallback?: string;
  skipRefresh?: boolean;
};

export const useFinanceAction = ({ onError, onSuccess, refresh }: FinanceActionOptions) => {
  const [isSaving, setIsSaving] = useState(false);

  const run = useCallback(
    async <T>(
      action: () => Promise<T>,
      successMessage: string,
      options?: RunFinanceActionOptions<T>,
    ): Promise<T | undefined> => {
      setIsSaving(true);
      try {
        const result = await action();
        onSuccess(successMessage);
        if (options?.afterSuccess) {
          await options.afterSuccess(result);
        }
        if (!options?.skipRefresh && refresh) {
          await refresh();
        }
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : options?.errorFallback ?? i18n.t('orders.messages.errors.operationFailed');
        onError(message);
        return undefined;
      } finally {
        setIsSaving(false);
      }
    },
    [onError, onSuccess, refresh],
  );

  return { isSaving, run };
};
