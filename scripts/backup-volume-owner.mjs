import { spawnSync } from 'node:child_process';
import { inspectDockerObject } from './production-docker-state.mjs';
import { projectRoot } from './production-env.mjs';

// Idempotent owner migration of the backup volume to the backend user `node`
// (UID/GID 1000). Older images ran as root, so existing volumes hold root-owned
// archives, metadata, yearly/ dumps and .restore-* temp folders.
//
// Runs in a one-off mongo:7 container (already required locally by docker:up:prod):
// no network, no ports, no pull, all capabilities dropped except what each step
// needs, only the declared backup volume mounted at /backups. Data is never moved
// or deleted; only owner and owner-write bits change.

export const BACKUP_OWNER = '1000:1000';
export const migrationImage = 'mongo:7';
export const OWNER_OK_STATUS = 0;
export const NEEDS_MIGRATION_STATUS = 20;
export const MOUNT_MISSING_STATUS = 30;

const notOwnedExpr = '\\( ! -uid 1000 -o ! -gid 1000 \\)';

// Prints the number of entries not owned by 1000:1000 and exits 20, or exits 0.
export const checkScript =
  `test -d /backups || exit ${MOUNT_MISSING_STATUS}; ` +
  `n=$(find /backups -xdev ${notOwnedExpr} -print | wc -l); ` +
  `if [ "$n" -eq 0 ]; then exit ${OWNER_OK_STATUS}; fi; ` +
  `echo "$n"; exit ${NEEDS_MIGRATION_STATUS}`;

export const migrateScript = `chown -R ${BACKUP_OWNER} /backups && chmod -R u+rwX /backups`;

export const buildVolumeRunArgs = (volumeName, mode) => {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(String(volumeName ?? ''))) {
    throw new Error('Invalid backup volume name.');
  }
  const caps = mode === 'migrate' ? ['CHOWN', 'DAC_OVERRIDE', 'FOWNER'] : ['DAC_READ_SEARCH'];
  return [
    'run',
    '--rm',
    '--pull',
    'never',
    '--network',
    'none',
    '--user',
    '0:0',
    '--cap-drop',
    'ALL',
    ...caps.flatMap((cap) => ['--cap-add', cap]),
    '--security-opt',
    'no-new-privileges:true',
    '--entrypoint',
    'sh',
    '--mount',
    `type=volume,source=${volumeName},target=/backups`,
    migrationImage,
    '-euc',
    mode === 'migrate' ? migrateScript : checkScript,
  ];
};

const defaultRunDocker = (args) =>
  spawnSync('docker', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const volumeFormat = '{{.Name}}|{{index .Labels "com.docker.compose.project"}}';

// Returns the volume's Compose project label ('' when absent) or null if missing.
export const inspectBackupVolume = (volumeName, { inspectDocker = inspectDockerObject } = {}) => {
  const raw = inspectDocker(['volume', 'inspect', volumeName, '--format', volumeFormat]);
  if (raw === null) return null;
  const [name, label = ''] = raw.split('|');
  if (name !== volumeName) return null;
  return { label: label === '<no value>' ? '' : label.trim() };
};

const describeRunFailure = (step, result) =>
  result.error
    ? `Backup volume ${step} failed: Docker could not start (${result.error.message}).`
    : `Backup volume ${step} failed (docker exited with status ${result.status}). ${String(result.stderr ?? '').trim()}`.trim();

// Returns 'unchanged' | 'migrated' | 'skipped'. Throws without changes when the
// volume is missing (unless allowMissing) or labelled for another Compose project.
export const migrateBackupVolumeOwner = ({
  volumeName,
  projectName,
  allowMissing = false,
  stopBackend = () => {},
  runDocker = defaultRunDocker,
  inspectDocker = inspectDockerObject,
  log = console.log,
}) => {
  const volume = inspectBackupVolume(volumeName, { inspectDocker });
  if (volume === null) {
    if (allowMissing) {
      log(`Backup volume ${volumeName} does not exist yet; a new volume gets owner ${BACKUP_OWNER} from the image.`);
      return 'skipped';
    }
    throw new Error(`The existing Docker volume ${volumeName} was not found. Nothing was changed.`);
  }
  if (volume.label && projectName && volume.label !== projectName) {
    throw new Error(
      `Backup volume ${volumeName} belongs to Compose project "${volume.label}", not "${projectName}". Nothing was changed.`,
    );
  }

  const check = () => {
    const result = runDocker(buildVolumeRunArgs(volumeName, 'check'));
    if (!result.error && result.status === OWNER_OK_STATUS) return 0;
    if (!result.error && result.status === NEEDS_MIGRATION_STATUS) {
      return Number.parseInt(String(result.stdout ?? '').trim(), 10) || 1;
    }
    throw new Error(describeRunFailure('ownership check', result));
  };

  const pending = check();
  if (pending === 0) {
    log(`Backup volume ${volumeName}: already owned by ${BACKUP_OWNER}.`);
    return 'unchanged';
  }

  log(`Backup volume ${volumeName}: ${pending} entries are not owned by ${BACKUP_OWNER}; stopping backend and migrating.`);
  stopBackend();
  const migrate = runDocker(buildVolumeRunArgs(volumeName, 'migrate'));
  if (migrate.error || migrate.status !== 0) {
    throw new Error(describeRunFailure('ownership migration', migrate));
  }
  const left = check();
  if (left !== 0) {
    throw new Error(`Backup volume ${volumeName}: ${left} entries are still not owned by ${BACKUP_OWNER} after migration.`);
  }
  log(`Backup volume ${volumeName}: ownership migrated to ${BACKUP_OWNER}.`);
  return 'migrated';
};

// Local (non-production) Compose: resolve the backup volume name and project from
// `docker compose config --format json`.
export const resolveComposeBackupVolume = (configJson) => {
  const config = JSON.parse(configJson);
  const name = config?.volumes?.['backup-data']?.name;
  if (!name) throw new Error('Compose configuration has no backup-data volume.');
  return { volumeName: name, projectName: config.name ?? '' };
};
