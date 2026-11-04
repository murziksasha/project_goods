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
// Distinct exit codes: 10 = keyfile missing or empty, 11 = wrong permissions/owner.
export const KEYFILE_MISSING_STATUS = 10;
export const KEYFILE_PERMISSIONS_STATUS = 11;
export const keyfileCheckArgs = [
  'run',
  '--rm',
  '--no-deps',
  '-T',
  'mongo-keyfile-init',
  '-euc',
  'test -s /run/mongo-keyfile/keyfile || exit 10; ' +
    'test "$(stat -c %a:%u:%g /run/mongo-keyfile)" = 700:999:999 || exit 11; ' +
    'test "$(stat -c %a:%u:%g /run/mongo-keyfile/keyfile)" = 400:999:999 || exit 11',
];

export const keyfileVolumeName = (projectName) => `${projectName || 'project_goods'}_mongo-keyfile`;

const enableAuthHint =
  'On a server that has never had auth enabled, also create the project_goods_admin and project_goods_app users first — see DOCUMENTATION/DEPLOYMENT.md (enabling auth).';

export const describeKeyfileCheckFailure = (status, volumeName) => {
  const fix = 'Run: npm run mongo:keyfile:prepare:prod.';
  if (status === KEYFILE_MISSING_STATUS) {
    return `MongoDB keyfile not found (missing or empty) in volume ${volumeName}. ${fix} ${enableAuthHint}`;
  }
  if (status === KEYFILE_PERMISSIONS_STATUS) {
    return `MongoDB keyfile has wrong permissions or owner in volume ${volumeName} (expected dir 700, file 400, uid/gid 999). ${fix} ${enableAuthHint}`;
  }
  return `MongoDB keyfile not found or has wrong permissions in volume ${volumeName} (check exited with status ${status}). ${fix} ${enableAuthHint}`;
};

// Short message naming the failed docker step (Docker's own output is already shown above it).
export const describeDockerStepFailure = (step, result) =>
  result?.error
    ? `Step failed: ${step}. Docker could not start: ${result.error.message}`
    : `Step failed: ${step} (docker exited with status ${result?.status ?? 'unknown'}). See the Docker output above.`;

const isKeyfileCheck = (args) => args.slice(-keyfileCheckArgs.length).join('\0') === keyfileCheckArgs.join('\0');

// Returns the error message for a failed docker step, or null on success.
export const dockerStepFailureMessage = (step, args, result, projectName) => {
  if (!result.error && result.status === 0) return null;
  if (!result.error && isKeyfileCheck(args)) {
    return describeKeyfileCheckFailure(result.status, keyfileVolumeName(projectName));
  }
  return describeDockerStepFailure(step, result);
};

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
