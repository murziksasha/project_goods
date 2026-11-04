import assert from 'node:assert/strict';
import test from 'node:test';
import { join } from 'node:path';
import {
  ADMIN_PASSWORD_ENV,
  APP_PASSWORD_ENV,
  EXIT_DOCKER,
  EXIT_HEALTH,
  EXIT_INVALID,
  adminPasswordFile,
  ensureUsersScript,
  parseAppPassword,
  parseOptionalAdminPassword,
  runUsersInit,
  tempMongoRunArgs,
} from './mongo-users-init-prod.mjs';
import { keyfileCheckArgs, productionComposeArgs } from './production-env.mjs';

const APP_SECRET = 'AppSecret_9f8e7d6c5b4a';
const ADMIN_SECRET = 'AdminSecret_1a2b3c4d5e6f';
const envFile = (extra = '') => [
  'COMPOSE_PROJECT_NAME=project_goods',
  'MONGO_DATA_VOLUME=project_goods_mongo-data',
  'BACKUP_DATA_VOLUME=project_goods_backup-data',
  `MONGO_URI=mongodb://project_goods_app:${APP_SECRET}@mongo:27017/inventory?authSource=inventory&replicaSet=rs0`,
  extra,
].join('\n');

const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });

// Fake docker: records every call; behaviour configurable per scenario.
const fakeDocker = ({ users = { admin: false, app: false }, keyfileStatus = [0], primaryAfter = 1, ensureFails = false } = {}) => {
  const calls = [];
  let primaryChecks = 0;
  const keyStatuses = [...keyfileStatus];
  const docker = (args, opts = {}) => {
    calls.push({ args, env: opts.env });
    const joined = args.join(' ');
    if (args[0] === 'exec' && joined.includes('isWritablePrimary')) {
      primaryChecks += 1;
      return ok(primaryChecks >= primaryAfter ? 'PRIMARY\n' : 'WAITING:rs0\n');
    }
    if (args[0] === 'exec' && joined.includes("print('USERS:'")) return ok(`USERS:${JSON.stringify(users)}\n`);
    if (args[0] === 'exec' && joined.includes('ensure(')) {
      if (ensureFails) return { status: 1, stdout: '', stderr: 'MongoServerError: boom' };
      return ok(
        `RESULT:project_goods_admin: ${users.admin ? 'exists, password kept, roles ensured' : 'created'}\n` +
          `RESULT:project_goods_app: ${users.app ? 'exists, password updated, roles ensured' : 'created'}\n`,
      );
    }
    if (joined.endsWith(keyfileCheckArgs.join(' '))) return { status: keyStatuses.shift() ?? 0, stdout: '', stderr: '' };
    return ok();
  };
  return { docker, calls };
};

const inspectFor = ({ images = true, mongoRunning = 'false' } = {}) => (args) => {
  if (args[0] === 'volume') return args[2];
  if (args[0] === 'image') return images ? 'sha256:x' : null;
  if (args.includes('{{.State.Running}}')) return mongoRunning;
  if (args.includes('{{index .Config.Labels "com.docker.compose.project"}}')) return 'project_goods';
  if (args.some((a) => a.includes('/data/db'))) return 'volume:project_goods_mongo-data';
  if (args.some((a) => a.includes('/app/backups'))) return 'volume:project_goods_backup-data';
  return null;
};

const memFs = (files = {}) => ({
  files,
  existsSync: (p) => p in files,
  readFileSync: (p) => files[p],
  mkdirSync: () => {},
  writeFileSync: (p, data, opts) => {
    if (opts?.flag === 'wx' && p in files) throw new Error('EEXIST');
    files[p] = data;
  },
});

const baseOptions = (over = {}) => {
  const logs = [];
  const nodeRuns = [];
  return {
    logs,
    nodeRuns,
    options: {
      readEnvFile: () => envFile(),
      gitState: () => 'abc1234',
      inspectDocker: inspectFor(),
      runNode: (script, args = []) => {
        nodeRuns.push([script, ...args].join(' '));
        return { status: 0 };
      },
      healthWait: async () => ({ ok: true, results: [{ url: 'http://a', ok: true }] }),
      sleep: async () => {},
      log: (line) => logs.push(line),
      home: '/home/u',
      fs: memFs(),
      nameSuffix: 'test',
      ...over,
    },
  };
};

const assertNoSecretsInArgs = (calls, logs) => {
  for (const { args } of calls) {
    const joined = args.join(' ');
    assert.ok(!joined.includes(APP_SECRET), `app secret leaked in docker args: ${joined}`);
    assert.ok(!joined.includes(ADMIN_SECRET), 'admin secret leaked in docker args');
  }
  for (const line of logs) {
    assert.ok(!String(line).includes(APP_SECRET) && !String(line).includes(ADMIN_SECRET), 'secret leaked in log');
  }
};

test('temporary MongoDB: existing data volume, no keyfile, no ports, no network, rs0', () => {
  const args = tempMongoRunArgs('tmp', 'project_goods_mongo-data');
  assert.ok(args.includes('--rm'));
  assert.deepEqual(args.slice(args.indexOf('--network'), args.indexOf('--network') + 2), ['--network', 'none']);
  assert.ok(!args.includes('-p') && !args.includes('--publish'));
  assert.ok(!args.join(' ').includes('keyFile') && !args.join(' ').includes('--auth'));
  assert.ok(args.includes('project_goods_mongo-data:/data/db'));
  assert.deepEqual(args.slice(args.indexOf('--replSet'), args.indexOf('--replSet') + 2), ['--replSet', 'rs0']);
  assert.ok(args.includes('mongo:127.0.0.1'));
});

test('users script: required roles, idempotent update, passwords only from env', () => {
  assert.match(ensureUsersScript, /userAdminAnyDatabase/);
  assert.match(ensureUsersScript, /"readWrite","db":"inventory"/);
  assert.match(ensureUsersScript, /"dbAdmin","db":"inventory"/);
  assert.match(ensureUsersScript, /createUser/);
  assert.match(ensureUsersScript, /updateUser/);
  assert.match(ensureUsersScript, /grantRolesToUser/);
  assert.doesNotMatch(ensureUsersScript, /dropUser|revokeRoles|dropDatabase/);
  assert.match(ensureUsersScript, new RegExp(`process\\.env\\[pwdEnv\\]`));
  assert.ok(ensureUsersScript.includes(APP_PASSWORD_ENV) && ensureUsersScript.includes(ADMIN_PASSWORD_ENV));
});

test('app password comes from the URI; optional admin password is validated', () => {
  assert.equal(parseAppPassword('mongodb://u:p%40ss_word@mongo:27017/inventory'), 'p@ss_word');
  assert.equal(parseOptionalAdminPassword(envFile()), null);
  assert.equal(parseOptionalAdminPassword(envFile(`MONGO_ADMIN_PASSWORD="${ADMIN_SECRET}"`)), ADMIN_SECRET);
  assert.equal(parseOptionalAdminPassword(envFile('MONGO_ADMIN_PASSWORD=REPLACE_WITH_PASSWORD')), null);
  assert.throws(() => parseOptionalAdminPassword(envFile('MONGO_ADMIN_PASSWORD=short')), /at least 12/);
  assert.throws(
    () => parseOptionalAdminPassword(envFile(`MONGO_ADMIN_PASSWORD=${ADMIN_SECRET}\nMONGO_ADMIN_PASSWORD=${ADMIN_SECRET}`)),
    /more than once/,
  );
});

test('fresh server: stops stack, creates both users, generates admin password file, starts prod', async () => {
  const { docker, calls } = fakeDocker({ keyfileStatus: [10, 0] });
  const { options, logs, nodeRuns } = baseOptions({ docker });
  const result = await runUsersInit(options);
  assert.deepEqual(result.results, ['project_goods_admin: created', 'project_goods_app: created']);

  const order = calls.map(({ args }) => args.join(' '));
  const stopIdx = order.indexOf([...productionComposeArgs, 'stop'].join(' '));
  const runIdx = order.findIndex((a) => a.startsWith('run -d --rm --name project_goods_mongo_users_init_test'));
  const tmpStopIdx = order.indexOf('stop -t 60 project_goods_mongo_users_init_test');
  assert.ok(stopIdx >= 0 && runIdx > stopIdx && tmpStopIdx > runIdx);
  assert.ok(order.includes('rm -f project_goods_mongo_users_init_test'));
  for (const a of order) {
    assert.ok(!/\bdown\b/.test(a), `unexpected down: ${a}`);
    assert.ok(!/volume rm|\brm -v\b|-f -v/.test(a), `unexpected volume removal: ${a}`);
  }

  const ensureCall = calls.find(({ args }) => args.join(' ').includes('ensure('));
  assert.deepEqual(ensureCall.args.slice(0, 5), ['exec', '-e', APP_PASSWORD_ENV, '-e', ADMIN_PASSWORD_ENV]);
  assert.equal(ensureCall.env[APP_PASSWORD_ENV], APP_SECRET);
  const file = adminPasswordFile('/home/u');
  assert.equal(file, join('/home/u', 'project_goods_secrets', 'mongo-admin-password.txt'));
  const generated = options.fs.files[file].trim();
  assert.ok(generated.length >= 24);
  assert.equal(ensureCall.env[ADMIN_PASSWORD_ENV], generated);
  assert.ok(!logs.some((line) => String(line).includes(generated)), 'generated admin password printed');

  assert.deepEqual(nodeRuns, ['scripts/prepare-mongo-keyfile.mjs', 'scripts/docker-up.mjs --prod']);
  assertNoSecretsInArgs(calls, logs);
});

test('existing users: idempotent update keeps admin password when none supplied', async () => {
  const { docker, calls } = fakeDocker({ users: { admin: true, app: true } });
  const { options, logs, nodeRuns } = baseOptions({ docker });
  const result = await runUsersInit(options);
  assert.match(result.results[0], /project_goods_admin: exists, password kept/);
  assert.match(result.results[1], /project_goods_app: exists, password updated/);
  const ensureCall = calls.find(({ args }) => args.join(' ').includes('ensure('));
  assert.equal(ensureCall.env[ADMIN_PASSWORD_ENV], '');
  assert.deepEqual(Object.keys(options.fs.files), [], 'no admin password file written');
  assert.deepEqual(nodeRuns, ['scripts/docker-up.mjs --prod']);
  assertNoSecretsInArgs(calls, logs);
});

test('admin password from .env.production is used and never put on the command line', async () => {
  const { docker, calls } = fakeDocker();
  const { options, logs } = baseOptions({ docker, readEnvFile: () => envFile(`MONGO_ADMIN_PASSWORD=${ADMIN_SECRET}`) });
  await runUsersInit(options);
  const ensureCall = calls.find(({ args }) => args.join(' ').includes('ensure('));
  assert.equal(ensureCall.env[ADMIN_PASSWORD_ENV], ADMIN_SECRET);
  assert.deepEqual(Object.keys(options.fs.files), []);
  assertNoSecretsInArgs(calls, logs);
});

test('missing images are built before anything is stopped', async () => {
  const { docker, calls } = fakeDocker({ users: { admin: true, app: true } });
  const { options, nodeRuns } = baseOptions({ docker, inspectDocker: inspectFor({ images: false }) });
  await runUsersInit({ ...options, inspectDocker: (args) => (args[0] === 'image' && args[2] !== 'mongo:7' ? null : inspectFor()(args)) });
  assert.equal(nodeRuns[0], 'scripts/docker-build-prod.mjs');
  assert.ok(calls.length > 0);
});

test('invalid .env.production stops before docker is touched', async () => {
  const { docker, calls } = fakeDocker();
  const { options } = baseOptions({ docker, readEnvFile: () => 'MONGO_URI=mongodb://mongo:27017/inventory' });
  await assert.rejects(runUsersInit(options), (error) => error.code === EXIT_INVALID);
  assert.equal(calls.length, 0);
});

test('a missing data volume stops before docker changes anything', async () => {
  const { docker, calls } = fakeDocker();
  const inspect = (args) => (args[0] === 'volume' ? null : inspectFor()(args));
  const { options } = baseOptions({ docker, inspectDocker: inspect });
  await assert.rejects(runUsersInit(options), (error) => error.code === EXIT_INVALID && /was not found/.test(error.message));
  assert.equal(calls.length, 0);
});

test('refuses to start temporary MongoDB while production mongo is still running', async () => {
  const { docker, calls } = fakeDocker();
  const { options } = baseOptions({ docker, inspectDocker: inspectFor({ mongoRunning: 'true' }) });
  await assert.rejects(runUsersInit(options), /still running/);
  assert.ok(!calls.some(({ args }) => args[0] === 'run'));
});

test('temporary container is removed even when user creation fails', async () => {
  const { docker, calls } = fakeDocker({ ensureFails: true });
  const { options, nodeRuns, logs } = baseOptions({ docker });
  await assert.rejects(runUsersInit(options), (error) => error.code === EXIT_DOCKER && /create or update MongoDB users/.test(error.message));
  const order = calls.map(({ args }) => args.join(' '));
  assert.ok(order.includes('stop -t 60 project_goods_mongo_users_init_test'));
  assert.ok(order.includes('rm -f project_goods_mongo_users_init_test'));
  assert.deepEqual(nodeRuns, [], 'prod is not started with broken users');
  assertNoSecretsInArgs(calls, logs);
});

test('primary wait times out with a clear message and cleans up', async () => {
  const { docker, calls } = fakeDocker({ primaryAfter: Infinity });
  const { options } = baseOptions({ docker, primaryTimeoutMs: 0 });
  await assert.rejects(runUsersInit(options), /did not become PRIMARY of rs0/);
  assert.ok(calls.some(({ args }) => args.join(' ') === 'rm -f project_goods_mongo_users_init_test'));
});

test('failed health check exits with the health code', async () => {
  const { docker } = fakeDocker({ users: { admin: true, app: true } });
  const { options } = baseOptions({
    docker,
    healthWait: async () => ({ ok: false, results: [{ url: 'http://a', reason: 'mongoOk is not true' }] }),
  });
  await assert.rejects(runUsersInit(options), (error) => error.code === EXIT_HEALTH);
});
