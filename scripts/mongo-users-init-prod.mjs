import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KEYFILE_MISSING_STATUS,
  KEYFILE_PERMISSIONS_STATUS,
  describeDockerStepFailure,
  describeKeyfileCheckFailure,
  keyfileCheckArgs,
  keyfileVolumeName,
  parseProductionConfig,
  productionChildEnvironment,
  productionComposeArgs,
  productionEnvPath,
  productionImageRefs,
  projectRoot,
} from './production-env.mjs';
import { assertProductionDockerState, inspectDockerObject } from './production-docker-state.mjs';
import { assertCleanReleaseCheckout } from './production-git-state.mjs';
import { waitForHealthy } from './update-prod.mjs';

// First-time MongoDB auth on a server whose existing mongo-data volume has no users yet:
//   1. validate .env.production, clean checkout, existing volumes; build images if missing
//   2. stop the production stack (compose stop; never down, never -v)
//   3. start a temporary MongoDB WITHOUT keyfile/auth on the existing data volume
//      (no published ports, no network), wait until rs0 is writable PRIMARY
//   4. create or update project_goods_admin and project_goods_app (idempotent)
//   5. stop/remove the temporary container (volumes are kept)
//   6. prepare the keyfile if missing, start the authenticated stack, wait for /api/health
// Passwords are passed to mongosh through the environment, never as arguments, never printed.

export const ADMIN_USER = 'project_goods_admin';
export const APP_USER = 'project_goods_app';
export const ADMIN_ROLES = [{ role: 'userAdminAnyDatabase', db: 'admin' }];
export const APP_ROLES = [
  { role: 'readWrite', db: 'inventory' },
  { role: 'dbAdmin', db: 'inventory' },
];
export const APP_PASSWORD_ENV = 'PG_INIT_APP_PASSWORD';
export const ADMIN_PASSWORD_ENV = 'PG_INIT_ADMIN_PASSWORD';
export const adminPasswordFile = (home = homedir()) =>
  join(home, 'project_goods_secrets', 'mongo-admin-password.txt');

export const EXIT_INVALID = 1;
export const EXIT_DOCKER = 2;
export const EXIT_HEALTH = 3;

class StepError extends Error {
  constructor(message, code = EXIT_DOCKER) {
    super(message);
    this.code = code;
  }
}

// Application password from the validated MONGO_URI (URL-decoded).
export const parseAppPassword = (mongoUri) => {
  const password = decodeURIComponent(new URL(mongoUri).password);
  if (!password) throw new StepError('MONGO_URI in .env.production has no application password.', EXIT_INVALID);
  return password;
};

// Optional MONGO_ADMIN_PASSWORD in .env.production. Returns null when absent.
export const parseOptionalAdminPassword = (contents) => {
  const lines = contents.split(/\r?\n/).filter((line) => /^\s*MONGO_ADMIN_PASSWORD\s*=/.test(line));
  if (lines.length === 0) return null;
  if (lines.length > 1) throw new StepError('MONGO_ADMIN_PASSWORD is set more than once in .env.production.', EXIT_INVALID);
  let value = lines[0].slice(lines[0].indexOf('=') + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!value || /^REPLACE_WITH/.test(value)) return null;
  if (value.length < 12) throw new StepError('MONGO_ADMIN_PASSWORD in .env.production must be at least 12 characters.', EXIT_INVALID);
  return value;
};

export const tempContainerName = (suffix = randomBytes(4).toString('hex')) =>
  `project_goods_mongo_users_init_${suffix}`;

// Temporary MongoDB on the existing data volume: no keyfile, no auth, no published
// ports and no network. Hostname "mongo" resolves to loopback so the member finds
// itself in the stored rs0 config (host mongo:27017) and becomes PRIMARY.
export const tempMongoRunArgs = (name, mongoDataVolume) => [
  'run',
  '-d',
  '--rm',
  '--name',
  name,
  '--network',
  'none',
  '--hostname',
  'mongo',
  '--add-host',
  'mongo:127.0.0.1',
  '-v',
  `${mongoDataVolume}:/data/db`,
  'mongo:7',
  'mongod',
  '--replSet',
  'rs0',
  '--bind_ip',
  '127.0.0.1',
  '--port',
  '27017',
];

export const primaryCheckScript =
  "try { const h = db.hello(); print(h.isWritablePrimary === true ? 'PRIMARY' : 'WAITING:' + (h.setName || 'no-replica-set')); } catch (e) { print('WAITING:' + e.codeName); }";

export const userStateScript = [
  `const a = db.getSiblingDB('admin').getUser('${ADMIN_USER}');`,
  `const p = db.getSiblingDB('inventory').getUser('${APP_USER}');`,
  "print('USERS:' + JSON.stringify({ admin: !!a, app: !!p }));",
].join(' ');

// Idempotent create-or-update. Existing users get their password set (when one is
// supplied) and the required roles granted additively; other roles are not removed.
export const ensureUsersScript = [
  'const ensure = (dbName, user, pwdEnv, roles) => {',
  '  const target = db.getSiblingDB(dbName);',
  '  const pwd = process.env[pwdEnv] || "";',
  '  if (!target.getUser(user)) {',
  '    if (!pwd) throw new Error(user + ": no password available to create the user");',
  '    target.createUser({ user, pwd, roles });',
  '    print("RESULT:" + user + ": created");',
  '    return;',
  '  }',
  '  if (pwd) target.updateUser(user, { pwd });',
  '  target.grantRolesToUser(user, roles);',
  '  print("RESULT:" + user + ": exists, " + (pwd ? "password updated" : "password kept") + ", roles ensured");',
  '};',
  `ensure('admin', '${ADMIN_USER}', '${ADMIN_PASSWORD_ENV}', ${JSON.stringify(ADMIN_ROLES)});`,
  `ensure('inventory', '${APP_USER}', '${APP_PASSWORD_ENV}', ${JSON.stringify(APP_ROLES)});`,
].join('\n');

const defaultDocker = (args, { input, env, inherit = false } = {}) =>
  spawnSync('docker', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    input,
    env: env ?? productionChildEnvironment(),
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe'],
  });

const defaultRunNode = (script, args = []) =>
  spawnSync(process.execPath, [script, ...args], { cwd: projectRoot, stdio: 'inherit', env: process.env });

const ensureOk = (step, result) => {
  if (result.error || result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    throw new StepError(`${describeDockerStepFailure(step, result)}${stderr ? `\n${stderr}` : ''}`);
  }
  return String(result.stdout ?? '');
};

// Resolves the admin password: .env.production, then a previously saved file,
// otherwise null (keep an existing admin, or generate one when it is missing).
const readSavedAdminPassword = (file, fs) => {
  if (!fs.existsSync(file)) return null;
  const value = fs.readFileSync(file, 'utf8').trim();
  return value || null;
};

const saveGeneratedAdminPassword = (file, fs) => {
  const password = randomBytes(24).toString('base64url');
  fs.mkdirSync(join(file, '..'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${password}\n`, { flag: 'wx', mode: 0o600 });
  return password;
};

export const runUsersInit = async ({
  readEnvFile = () => {
    if (!statSync(productionEnvPath).isFile()) throw new Error('not a file');
    return readFileSync(productionEnvPath, 'utf8');
  },
  gitState = assertCleanReleaseCheckout,
  docker = defaultDocker,
  inspectDocker = inspectDockerObject,
  runNode = defaultRunNode,
  healthWait = waitForHealthy,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
  home = homedir(),
  fs = { existsSync, mkdirSync, readFileSync, writeFileSync },
  nameSuffix,
  primaryTimeoutMs = 90_000,
  healthTimeoutMs = Number(process.env.UPDATE_PROD_HEALTH_TIMEOUT_MS) || 90_000,
} = {}) => {
  const step = (n, text) => log(`\n[mongo:users:init:prod] ${n}/6 ${text}`);

  step(1, 'Validating .env.production, Git checkout, volumes and images.');
  let contents;
  try {
    contents = readEnvFile();
  } catch {
    throw new StepError('A private .env.production file is required. See .env.production.example.', EXIT_INVALID);
  }
  let config;
  try {
    config = parseProductionConfig(contents);
  } catch (error) {
    throw new StepError(error.message, EXIT_INVALID);
  }
  const appPassword = parseAppPassword(config.mongoUri);
  let adminPassword = parseOptionalAdminPassword(contents);
  let gitSha;
  try {
    gitSha = gitState();
    assertProductionDockerState(config, { inspectDocker });
  } catch (error) {
    throw new StepError(error.message, EXIT_INVALID);
  }
  ensureOk('check mongo:7 image is present', docker(['image', 'inspect', 'mongo:7', '--format', '{{.Id}}']));
  const missingImages = productionImageRefs(gitSha).filter(
    (ref) => inspectDocker(['image', 'inspect', ref, '--format', '{{.Id}}']) === null,
  );
  if (missingImages.length > 0) {
    log(`Images for ${gitSha} are missing (${missingImages.join(', ')}); building them now (docker:build:prod).`);
    const build = runNode('scripts/docker-build-prod.mjs');
    if (build.error || build.status !== 0) {
      throw new StepError('docker:build:prod failed. Nothing was stopped.');
    }
  }
  log(`Configuration OK: project ${config.projectName}, data volume ${config.mongoDataVolume}, version ${gitSha}.`);

  step(2, 'Stopping the production stack (compose stop; volumes are kept).');
  ensureOk('stop production containers', docker([...productionComposeArgs, 'stop'], { inherit: true }));
  const running = inspectDocker(['inspect', '--format', '{{.State.Running}}', 'project_goods_mongo']);
  if (running !== null && running !== 'false') {
    throw new StepError('project_goods_mongo is still running after stop; refusing to open its volume twice.');
  }

  const name = tempContainerName(nameSuffix);
  step(3, `Starting temporary MongoDB without auth (${name}, no ports, no network).`);
  let started = false;
  const results = [];
  try {
    ensureOk('start temporary MongoDB', docker(tempMongoRunArgs(name, config.mongoDataVolume)));
    started = true;
    const deadline = Date.now() + primaryTimeoutMs;
    let lastState = 'not started';
    for (;;) {
      const check = docker(['exec', name, 'mongosh', '--quiet', '--eval', primaryCheckScript]);
      const out = String(check.stdout ?? '').trim().split(/\r?\n/).at(-1) ?? '';
      if (check.status === 0 && out === 'PRIMARY') break;
      if (/no such container|is not running/i.test(String(check.stderr ?? ''))) {
        started = false;
        throw new StepError(`Temporary MongoDB ${name} exited during startup. The data volume may be in use or damaged.`);
      }
      lastState = out || String(check.stderr ?? '').trim().split(/\r?\n/).at(-1) || `exit ${check.status}`;
      if (Date.now() + 2_000 > deadline) {
        throw new StepError(
          `Temporary MongoDB did not become PRIMARY of rs0 in time (last state: ${lastState}). ` +
            'The data volume may not contain an initialized rs0 replica set.',
        );
      }
      await sleep(2_000);
    }
    log('Temporary MongoDB is PRIMARY of rs0.');

    step(4, `Creating or updating ${ADMIN_USER} and ${APP_USER}.`);
    const stateOut = ensureOk('read existing users', docker(['exec', name, 'mongosh', '--quiet', '--eval', userStateScript]));
    const stateLine = stateOut.split(/\r?\n/).find((line) => line.startsWith('USERS:'));
    if (!stateLine) throw new StepError('Could not read the existing MongoDB users.');
    const existing = JSON.parse(stateLine.slice('USERS:'.length));

    const file = adminPasswordFile(home);
    if (!adminPassword) adminPassword = readSavedAdminPassword(file, fs);
    if (!adminPassword && !existing.admin) {
      adminPassword = saveGeneratedAdminPassword(file, fs);
      log(`Generated a new ${ADMIN_USER} password and saved it to ${file} (not printed).`);
      log('Move it to your password manager, then delete that file.');
    }

    const env = productionChildEnvironment({
      [APP_PASSWORD_ENV]: appPassword,
      [ADMIN_PASSWORD_ENV]: adminPassword ?? '',
    });
    const ensureOut = ensureOk(
      'create or update MongoDB users',
      docker(['exec', '-e', APP_PASSWORD_ENV, '-e', ADMIN_PASSWORD_ENV, name, 'mongosh', '--quiet', '--eval', ensureUsersScript], { env }),
    );
    for (const line of ensureOut.split(/\r?\n/)) {
      if (line.startsWith('RESULT:')) {
        results.push(line.slice('RESULT:'.length));
        log(`  ${line.slice('RESULT:'.length)}`);
      }
    }
    if (results.length !== 2) throw new StepError('MongoDB did not confirm both users.');
  } finally {
    if (started) {
      step(5, `Stopping temporary MongoDB ${name} (data volume is kept).`);
      const stop = docker(['stop', '-t', '60', name]);
      if (stop.status !== 0 && !/no such container/i.test(String(stop.stderr ?? ''))) {
        log(`Warning: could not stop ${name}: ${String(stop.stderr ?? '').trim()}`);
      }
      // --rm removes it on stop; this only cleans up if it is still there.
      docker(['rm', '-f', name]);
    }
  }

  step(6, 'Checking the keyfile and starting the authenticated stack (docker:up:prod).');
  const keyCheck = () => docker([...productionComposeArgs, ...keyfileCheckArgs]);
  let key = keyCheck();
  if (key.status === KEYFILE_MISSING_STATUS || key.status === KEYFILE_PERMISSIONS_STATUS) {
    log('Keyfile is missing or invalid; running mongo:keyfile:prepare:prod.');
    const prepare = runNode('scripts/prepare-mongo-keyfile.mjs');
    if (prepare.error || prepare.status !== 0) throw new StepError('mongo:keyfile:prepare:prod failed.');
    key = keyCheck();
  }
  if (key.error || key.status !== 0) {
    throw new StepError(
      key.error
        ? describeDockerStepFailure('check MongoDB keyfile volume', key)
        : describeKeyfileCheckFailure(key.status, keyfileVolumeName(config.projectName)),
    );
  }

  const up = runNode('scripts/docker-up.mjs', ['--prod']);
  if (up.error || up.status !== 0) {
    throw new StepError('Users are ready, but docker:up:prod did not complete. See the output above.');
  }
  log(`Waiting up to ${Math.round(healthTimeoutMs / 1000)}s for /api/health (mongoOk=true, buildSha=${gitSha}).`);
  const health = await healthWait({ expectedSha: gitSha, timeoutMs: healthTimeoutMs });
  if (!health.ok) {
    for (const result of health.results) log(`  ${result.url}: ${result.reason}`);
    throw new StepError(
      'Users are ready, but /api/health did not pass in time. Check: npm run docker:logs:prod -- backend --no-follow',
      EXIT_HEALTH,
    );
  }
  log(`\nDone: ${results.join('; ')}. Version ${gitSha} is running with MongoDB auth (mongoOk=true).`);
  return { gitSha, results };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.length > 2) {
    console.error('mongo:users:init:prod does not accept arguments.');
    process.exit(EXIT_INVALID);
  }
  try {
    await runUsersInit();
  } catch (error) {
    console.error(`\nmongo:users:init:prod failed: ${error.message}`);
    console.error('Data volumes were not removed. If the stack was stopped, start it again with: npm run docker:up:prod');
    process.exit(error.code ?? EXIT_DOCKER);
  }
}
