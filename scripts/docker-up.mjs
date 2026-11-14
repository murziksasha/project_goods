import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  assertProductionEnvironment,
  assertLocalDevelopmentHost,
  productionChildEnvironment,
  productionComposeArgs,
  productionImageRefs,
  keyfileCheckArgs,
  dockerStepFailureMessage,
} from './production-env.mjs';
import {
  assertImagesPresent,
  assertProductionDockerState,
  describeAbsentContainers,
} from './production-docker-state.mjs';
import { assertCleanReleaseCheckout } from './production-git-state.mjs';
import { migrateBackupVolumeOwner, resolveComposeBackupVolume } from './backup-volume-owner.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--prod');
let productionConfig;
if (process.argv.slice(2).some((arg) => arg !== '--prod')) {
  console.error('Unknown docker-up option. Use --prod for the authenticated production stack.');
  process.exit(1);
}

if (production) {
  try {
    productionConfig = assertProductionEnvironment();
    const absent = describeAbsentContainers(assertProductionDockerState(productionConfig));
    if (absent.length > 0) {
      console.log(`Containers not found (will be created on the existing volumes): ${absent.join(', ')}.`);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
} else {
  try {
    assertLocalDevelopmentHost();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

const resolveGitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
};

const gitSha = production ? assertCleanReleaseCheckout() : resolveGitSha();
console.log(`${production ? 'Starting production images' : 'Building'} with GIT_SHA=${gitSha}`);

const environment = production
  ? productionChildEnvironment({ GIT_SHA: gitSha })
  : { ...process.env, GIT_SHA: gitSha };
environment.DOCKER_BUILDKIT = '1';
environment.COMPOSE_DOCKER_CLI_BUILD = '1';

const composeArgs = production ? productionComposeArgs : ['compose'];
const runDocker = (step, args) => {
  const result = spawnSync('docker', args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: environment,
  });
  const message = dockerStepFailureMessage(step, args, result, productionConfig?.projectName);
  if (message) {
    console.error(message);
    process.exit(result.error ? 1 : result.status || 1);
  }
};

if (production) {
  runDocker('validate Compose configuration', [...composeArgs, 'config', '-q']);
  try {
    assertImagesPresent(productionImageRefs(gitSha));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  runDocker('check mongo:7 image is present', ['image', 'inspect', 'mongo:7', '--format', '{{.Id}}']);
  runDocker('check MongoDB keyfile volume', [...composeArgs, ...keyfileCheckArgs]);
}

// Backend runs as node (UID 1000): migrate the backup volume owner before start.
// Idempotent; stops only the backend and only when a migration is needed.
const migrateBackupVolume = () => {
  let target;
  if (production) {
    target = {
      volumeName: productionConfig.backupDataVolume,
      projectName: productionConfig.projectName,
      allowMissing: false,
    };
  } else {
    const config = spawnSync('docker', [...composeArgs, 'config', '--format', 'json'], {
      cwd: rootDir,
      env: environment,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    if (config.error || config.status !== 0) {
      console.error('Step failed: read Compose configuration for the backup volume.');
      process.exit(1);
    }
    try {
      target = { ...resolveComposeBackupVolume(config.stdout), allowMissing: true };
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }
  try {
    return migrateBackupVolumeOwner({
      ...target,
      stopBackend: () => runDocker('stop backend before backup volume migration', [...composeArgs, 'stop', 'backend']),
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
};

if (production) {
  migrateBackupVolume();
}

runDocker(production ? 'start production containers' : 'build and start containers', [
  ...composeArgs,
  'up',
  '-d',
  ...(production ? ['--no-build', '--pull', 'never'] : ['--build']),
]);

if (!production) {
  // Local stack: images (and mongo:7) exist only after `up --build`; migrate an
  // older root-owned local backup volume afterwards and restart the backend.
  if (migrateBackupVolume() === 'migrated') {
    runDocker('restart backend after backup volume migration', [...composeArgs, 'up', '-d', 'backend']);
  }
}
