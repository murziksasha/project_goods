import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  assertProductionEnvironment,
  assertLocalDevelopmentHost,
  productionChildEnvironment,
  productionComposeArgs,
  productionImageRefs,
} from './production-env.mjs';
import {
  assertProductionDockerState,
  describeAbsentContainers,
} from './production-docker-state.mjs';
import { assertCleanReleaseCheckout } from './production-git-state.mjs';

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
const runDocker = (args) => {
  const result = spawnSync('docker', args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: environment,
  });
  if (result.error) {
    console.error(`Docker could not start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (production) {
  runDocker([...composeArgs, 'config', '-q']);
  runDocker(['image', 'inspect', 'mongo:7', '--format', '{{.Id}}']);
  for (const imageRef of productionImageRefs(gitSha)) {
    runDocker(['image', 'inspect', imageRef, '--format', '{{.Id}}']);
  }
  runDocker([
    ...composeArgs,
    'run',
    '--rm',
    '--no-deps',
    '-T',
    'mongo-keyfile-init',
    '-euc',
    'test -s /run/mongo-keyfile/keyfile; test "$(stat -c %a:%u:%g /run/mongo-keyfile)" = 700:999:999; test "$(stat -c %a:%u:%g /run/mongo-keyfile/keyfile)" = 400:999:999',
  ]);
}

runDocker([
  ...composeArgs,
  'up',
  '-d',
  ...(production ? ['--no-build', '--pull', 'never'] : ['--build']),
]);
