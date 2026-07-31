export type CollectionStorageStats = {
  name: string;
  count: number;
  sizeBytes: number;
  storageSizeBytes: number;
  totalIndexSizeBytes: number;
  avgObjSizeBytes: number;
  nindexes: number;
};

export type DatabaseStorageStats = {
  dbName: string;
  collectedAt: string;
  dataSizeBytes: number;
  storageSizeBytes: number;
  indexSizeBytes: number;
  collections: CollectionStorageStats[];
  totals: {
    documents: number;
    dataSizeBytes: number;
    storageSizeBytes: number;
    totalIndexSizeBytes: number;
  };
};

export type DatabaseHealthStatus = 'ok' | 'degraded';

export type DatabaseHealth = {
  status: DatabaseHealthStatus;
  ok: boolean;
  readyState: number;
  latencyMs: number | null;
  dbName: string | null;
  mongoVersion: string | null;
  uptimeSeconds: number | null;
  connections: {
    current: number | null;
    available: number | null;
  };
  collectedAt: string;
};
