import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const defaultPort = 5000;
const defaultMongoUri = 'mongodb://127.0.0.1:27017/inventory';

export type BackendEnv = {
  port: number;
  mongoUri: string;
  clientOrigin?: string;
  backupDir: string;
  backupCreateCommand?: string;
  backupRestoreCommand?: string;
  backupRestoreUploadLimit: string;
};

export const parseEnv = (
  rawEnv: Partial<
    Pick<
      NodeJS.ProcessEnv,
      | 'PORT'
      | 'MONGO_URI'
      | 'CLIENT_ORIGIN'
      | 'BACKUP_DIR'
      | 'BACKUP_CREATE_COMMAND'
      | 'BACKUP_RESTORE_COMMAND'
      | 'BACKUP_RESTORE_UPLOAD_LIMIT'
    >
  >,
): BackendEnv => {
  const port = Number(rawEnv.PORT ?? defaultPort);

  return {
    port: Number.isFinite(port) && port > 0 ? port : defaultPort,
    mongoUri: rawEnv.MONGO_URI ?? defaultMongoUri,
    clientOrigin: rawEnv.CLIENT_ORIGIN,
    backupDir: rawEnv.BACKUP_DIR ?? './backups',
    backupCreateCommand: rawEnv.BACKUP_CREATE_COMMAND,
    backupRestoreCommand: rawEnv.BACKUP_RESTORE_COMMAND,
    backupRestoreUploadLimit: rawEnv.BACKUP_RESTORE_UPLOAD_LIMIT ?? '10gb',
  };
};

export const env = parseEnv(process.env);
