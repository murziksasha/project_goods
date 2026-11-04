import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const productionEnvPath = resolve(projectRoot, '.env.production');
export const productionComposeArgs = [
  'compose',
  '--env-file',
  '.env.production',
  '-f',
  'docker-compose.yml',
  '-f',
  'docker-compose.prod.yml',
];
// docker-compose.rollback.yml only swaps backend/frontend to the saved :rollback
// images and pins the existing external volumes. Layered on top of the production
// file it keeps MongoDB auth (keyfile + app-user MONGO_URI from .env.production).
export const rollbackComposeArgs = [...productionComposeArgs, '-f', 'docker-compose.rollback.yml'];

// Emergency-only: the rollback images on the base (unauthenticated) MongoDB command
// and URI. Only for reverting the auth migration itself (docker:rollback:noauth).
export const noAuthRollbackComposeArgs = [
  'compose',
  '--env-file',
  '.env.production',
  '-f',
  'docker-compose.yml',
  '-f',
  'docker-compose.rollback.yml',
];

// Read-only check that the MongoDB keyfile volume is prepared (mode and owner).
export const keyfileCheckArgs = [
  'run',
  '--rm',
  '--no-deps',
  '-T',
  'mongo-keyfile-init',
  '-euc',
  'test -s /run/mongo-keyfile/keyfile; test "$(stat -c %a:%u:%g /run/mongo-keyfile)" = 700:999:999; test "$(stat -c %a:%u:%g /run/mongo-keyfile/keyfile)" = 400:999:999',
];

export const productionImageRefs = (gitSha) => [
  `project-goods/backend:${gitSha}`,
  `project-goods/frontend:${gitSha}`,
];
export const rollbackImageRefs = [
  'project-goods/backend:rollback',
  'project-goods/frontend:rollback',
];

const invalidEnv = () =>
  new Error(
    'A private .env.production file with the existing project and volume names plus an authenticated inventory MONGO_URI is required. See .env.production.example.',
  );

const readAssignment = (contents, name) => {
  const assignments = contents
    .split(/\r?\n/)
    .filter((line) => new RegExp(`^\\s*${name}\\s*=`).test(line));
  if (assignments.length !== 1) throw invalidEnv();

  let value = assignments[0].slice(assignments[0].indexOf('=') + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!value) throw invalidEnv();
  return value;
};

export const parseProductionMongoUri = (contents) => {
  const value = readAssignment(contents, 'MONGO_URI');

  try {
    const uri = new URL(value);
    if (
      uri.protocol !== 'mongodb:' ||
      uri.username !== 'project_goods_app' ||
      uri.hostname !== 'mongo' ||
      uri.port !== '27017' ||
      uri.pathname !== '/inventory' ||
      !uri.password ||
      [
        'REPLACE_WITH_RANDOM_URL_SAFE_PASSWORD',
        'REPLACE_WITH_PASSWORD',
      ].includes(uri.password) ||
      uri.searchParams.get('authSource') !== 'inventory' ||
      uri.searchParams.get('replicaSet') !== 'rs0'
    ) {
      throw invalidEnv();
    }
    return value;
  } catch {
    throw invalidEnv();
  }
};

export const parseProductionVolumeConfig = (contents) => {
  const projectName = readAssignment(contents, 'COMPOSE_PROJECT_NAME');
  const mongoDataVolume = readAssignment(contents, 'MONGO_DATA_VOLUME');
  const backupDataVolume = readAssignment(contents, 'BACKUP_DATA_VOLUME');
  if (
    !/^[a-z0-9][a-z0-9_-]*$/.test(projectName) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(mongoDataVolume) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(backupDataVolume) ||
    mongoDataVolume === backupDataVolume
  ) {
    throw invalidEnv();
  }
  return {
    projectName,
    mongoDataVolume,
    backupDataVolume,
  };
};

export const parseProductionConfig = (contents) => ({
  ...parseProductionVolumeConfig(contents),
  mongoUri: parseProductionMongoUri(contents),
});

const readPrivateProductionFile = () => {
  try {
    if (!statSync(productionEnvPath).isFile()) throw invalidEnv();
    return readFileSync(productionEnvPath, 'utf8');
  } catch {
    throw invalidEnv();
  }
};

export const assertProductionEnvironment = () => {
  return parseProductionConfig(readPrivateProductionFile());
};

export const assertProductionVolumeEnvironment = () =>
  parseProductionVolumeConfig(readPrivateProductionFile());

export const assertLocalDevelopmentHost = (hasProductionEnv = () => existsSync(productionEnvPath)) => {
  if (hasProductionEnv()) {
    throw new Error(
      'Production .env.production detected. Use docker:build:prod and docker:up:prod; local Docker commands are disabled on this host.',
    );
  }
};

// Docker Compose gives shell environment variables precedence over --env-file.
// The production launcher must use the MONGO_URI from the validated private file.
export const productionChildEnvironment = (additional = {}) => {
  const {
    MONGO_URI: _ignoredUri,
    COMPOSE_PROJECT_NAME: _ignoredProject,
    MONGO_DATA_VOLUME: _ignoredMongoVolume,
    BACKUP_DATA_VOLUME: _ignoredBackupVolume,
    ...environment
  } = process.env;
  return { ...environment, ...additional };
};
