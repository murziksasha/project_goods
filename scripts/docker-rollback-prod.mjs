import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertProductionEnvironment,
  assertProductionVolumeEnvironment,
  keyfileCheckArgs,
  noAuthRollbackComposeArgs,
  productionChildEnvironment,
  projectRoot,
  rollbackComposeArgs,
  rollbackImageRefs,
} from './production-env.mjs';
import {
  assertProductionDockerState,
  describeAbsentContainers,
  inspectDockerObject,
} from './production-docker-state.mjs';

// npm run docker:rollback:prod
//   Starts the saved project-goods/{backend,frontend}:rollback images on the existing
//   volumes WITH MongoDB auth: docker-compose.yml + docker-compose.prod.yml (keyfile,
//   app-user MONGO_URI from .env.production) + docker-compose.rollback.yml (images).
//
// npm run docker:rollback:noauth -- --confirm-noauth
//   Emergency only, for reverting the auth migration itself: the same rollback
//   images on the base MongoDB command/URI, i.e. MongoDB WITHOUT access control.

export const noAuthConfirmFlag = '--confirm-noauth';

export const noAuthWarning = [
  '',
  '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
  '!! WARNING: docker:rollback:noauth starts MongoDB WITHOUT the keyfile  !!',
  '!! and WITHOUT access control. Anyone who can reach 127.0.0.1:27017    !!',
  '!! on this host can read or delete ALL data without a password.       !!',
  '!! Use it ONLY to revert the MongoDB auth migration itself. For a      !!',
  '!! normal release rollback use: npm run docker:rollback:prod           !!',
  '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
  '',
].join('\n');

// Parses CLI args into a rollback mode. Throws on unknown or unconfirmed options.
export const parseRollbackArgs = (argv) => {
  const known = new Set(['--noauth', noAuthConfirmFlag]);
  for (const arg of argv) {
    if (!known.has(arg)) throw new Error(`Unknown rollback option: ${arg}`);
  }
  const noAuth = argv.includes('--noauth');
  if (!noAuth && argv.includes(noAuthConfirmFlag)) {
    throw new Error(`${noAuthConfirmFlag} is only valid with docker:rollback:noauth.`);
  }
  if (noAuth && !argv.includes(noAuthConfirmFlag)) {
    throw new Error(
      `${noAuthWarning}\nRefusing to start without explicit confirmation. Re-run as:\n  npm run docker:rollback:noauth -- ${noAuthConfirmFlag}`,
    );
  }
  return { auth: !noAuth };
};

// Docker commands for a rollback (excluding the read-only state/image checks).
export const buildRollbackPlan = ({ auth }) => {
  const composeArgs = auth ? rollbackComposeArgs : noAuthRollbackComposeArgs;
  const up = [
    ...composeArgs,
    'up',
    '-d',
    '--no-build',
    '--pull',
    'never',
    '--force-recreate',
    'mongo',
    'backend',
    'frontend',
  ];
  return {
    composeArgs,
    steps: [
      [...composeArgs, 'config', '-q'],
      ...(auth ? [[...composeArgs, ...keyfileCheckArgs]] : []),
      up,
    ],
  };
};

export const missingRollbackImageMessage = (imageRef) =>
  `Rollback image ${imageRef} not found. Rollback tags are saved by npm run docker:build:prod (or update:prod) from the running containers; nothing was changed.`;

export const assertRollbackImagesPresent = ({ inspectDocker = inspectDockerObject } = {}) => {
  for (const imageRef of [...rollbackImageRefs, 'mongo:7']) {
    if (inspectDocker(['image', 'inspect', imageRef, '--format', '{{.Id}}']) === null) {
      throw new Error(missingRollbackImageMessage(imageRef));
    }
  }
};

const shaPattern = /^(?:[0-9a-f]{7,40}|dev|unknown)$/;

// Reads BUILD_SHA baked into the rollback backend image so /api/health reports the
// real rolled-back version instead of the Compose default.
export const readImageBuildSha = (imageRef, { inspectDocker = inspectDockerObject } = {}) => {
  const raw = inspectDocker(['image', 'inspect', imageRef, '--format', '{{json .Config.Env}}']);
  if (!raw) return null;
  let env;
  try {
    env = JSON.parse(raw);
  } catch {
    return null;
  }
  const entry = Array.isArray(env) ? env.find((item) => String(item).startsWith('BUILD_SHA=')) : null;
  const value = entry ? String(entry).slice('BUILD_SHA='.length) : null;
  return value && shaPattern.test(value) ? value : null;
};

const main = () => {
  let mode;
  try {
    mode = parseRollbackArgs(process.argv.slice(2));
    const config = mode.auth ? assertProductionEnvironment() : assertProductionVolumeEnvironment();
    const absent = describeAbsentContainers(
      assertProductionDockerState(config, { requireBackend: mode.auth }),
    );
    if (absent.length > 0) {
      console.log(`Containers not found (will be created on the existing volumes): ${absent.join(', ')}.`);
    }
    assertRollbackImagesPresent();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (!mode.auth) console.error(noAuthWarning);

  const rollbackSha = readImageBuildSha(rollbackImageRefs[0]);
  const environment = productionChildEnvironment(rollbackSha ? { GIT_SHA: rollbackSha } : {});
  const runDocker = (args) => {
    const result = spawnSync('docker', args, { cwd: projectRoot, stdio: 'inherit', env: environment });
    if (result.error || result.status !== 0) {
      console.error(result.error?.message ?? 'Docker command failed.');
      process.exit(result.status || 1);
    }
  };

  console.log(
    `Rolling back to ${rollbackImageRefs.join(', ')}${rollbackSha ? ` (build ${rollbackSha})` : ''} ` +
      `${mode.auth ? 'with MongoDB auth (keyfile + .env.production MONGO_URI)' : 'WITHOUT MongoDB auth'}.`,
  );
  for (const step of buildRollbackPlan(mode).steps) runDocker(step);

  console.log(
    mode.auth
      ? 'Rollback stack started with MongoDB auth. Confirm MongoDB primary and backend /api/health mongoOk=true before reopening shop access.'
      : 'Rollback stack started WITHOUT MongoDB auth. Confirm health, then restore auth as soon as possible.',
  );
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
