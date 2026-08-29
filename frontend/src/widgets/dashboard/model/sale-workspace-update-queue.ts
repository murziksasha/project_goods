import type { Sale } from '../../../entities/sale/model/types';

export type SaleWorkspaceQueuePayload = {
  status?: string;
  paidAmount?: number;
  masterId?: string;
  issuedById?: string;
  deviceName?: string;
  serialNumber?: string;
  discount?: Sale['discount'];
  timeline?: Sale['timeline'];
  paymentHistory?: Sale['paymentHistory'];
  lineItems?: Sale['lineItems'];
  userNote?: string;
};

export type SaleWorkspaceUpdater = (
  latest: Sale,
) => SaleWorkspaceQueuePayload | null | undefined;

type SaleWorkspaceUpdateQueueOptions = {
  persist: (sale: Sale, payload: SaleWorkspaceQueuePayload) => Promise<Sale>;
  getLatestSale: (saleId: string) => Sale | undefined;
  onError: (error: unknown, fallback?: string) => void;
};

export const createSaleWorkspaceUpdateQueue = ({
  persist,
  getLatestSale,
  onError,
}: SaleWorkspaceUpdateQueueOptions) => {
  const chains = new Map<string, Promise<void>>();

  const runExclusive = <T,>(
    saleId: string,
    task: (latest: Sale) => Promise<T>,
  ): Promise<T> => {
    const previous = chains.get(saleId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(async () => {
      const latest = getLatestSale(saleId);
      if (!latest) {
        throw new Error('Sale is no longer loaded.');
      }
      return task(latest);
    });
    chains.set(
      saleId,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  };

  const enqueue = (
    saleId: string,
    updater: SaleWorkspaceUpdater,
    fallback?: string,
  ) => {
    void runExclusive(saleId, async (latest) => {
      const payload = updater(latest);
      if (!payload) return latest;
      return persist(latest, payload);
    }).catch((error: unknown) => {
      onError(error, fallback);
    });
  };

  return { enqueue, runExclusive };
};
