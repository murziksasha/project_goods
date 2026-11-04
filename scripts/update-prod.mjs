import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertProductionEnvironment,
  productionChildEnvironment,
  productionComposeArgs,
  projectRoot,
} from './production-env.mjs';
import { assertCleanReleaseCheckout } from './production-git-state.mjs';

// One-command production update for an already pulled, clean checkout:
//   1. validate .env.production
//   2. docker:build:prod  (save rollback tags, build images for the current GIT_SHA)
//   3. docker:up:prod     (recreate containers on the existing volumes)
//   4. wait for /api/health: mongoOk === true and buildSha === current GIT_SHA
// It never runs `git pull`, never uses `down`, and never rolls back on its own.

export const healthUrls = [
  'http://127.0.0.1:5000/api/health',
  'http://127.0.0.1:5173/api/health',
];
export const defaultHealthTimeoutMs = 90_000;
export const rollbackHint = 'npm run docker:rollback:prod';

// Decides whether a parsed /api/health payload belongs to a healthy new release.
export const evaluateHealth = (payload, expectedSha) => {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'no JSON health payload' };
  if (payload.mongoOk !== true) return { ok: false, reason: 'mongoOk is not true' };
  if (payload.buildSha !== expectedSha) {
    return { ok: false, reason: `buildSha is ${payload.buildSha ?? 'missing'}, expected ${expectedSha}` };
  }
  return { ok: true, reason: 'healthy' };
};

const checkUrl = async (url, expectedSha, fetchImpl, requestTimeoutMs) => {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(requestTimeoutMs) });
    if (!response.ok) return { url, ok: false, reason: `HTTP ${response.status}` };
    let payload;
    try {
      payload = await response.json();
    } catch {
      return { url, ok: false, reason: 'response is not JSON' };
    }
    return { url, ...evaluateHealth(payload, expectedSha), payload };
  } catch (error) {
    return { url, ok: false, reason: error?.cause?.code ?? error?.name ?? 'request failed' };
  }
};

// Polls every URL until all are healthy for expectedSha or the deadline passes.
export const waitForHealthy = async ({
  expectedSha,
  urls = healthUrls,
  timeoutMs = defaultHealthTimeoutMs,
  intervalMs = 3_000,
  requestTimeoutMs = 5_000,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
} = {}) => {
  const deadline = now() + timeoutMs;
  let attempts = 0;
  let results = [];
  for (;;) {
    attempts += 1;
    results = await Promise.all(urls.map((url) => checkUrl(url, expectedSha, fetchImpl, requestTimeoutMs)));
    if (results.every((result) => result.ok)) return { ok: true, attempts, results };
    if (now() + intervalMs > deadline) return { ok: false, attempts, results };
    await sleep(intervalMs);
  }
};

const runNode = (script, args = []) =>
  spawnSync(process.execPath, [script, ...args], { cwd: projectRoot, stdio: 'inherit', env: process.env });

const printBackendLogs = () => {
  console.error('\nLast backend logs:');
  const result = spawnSync(
    'docker',
    [...productionComposeArgs, 'logs', '--no-color', '--tail=80', 'backend'],
    { cwd: projectRoot, stdio: 'inherit', env: productionChildEnvironment() },
  );
  if (result.error) console.error(`Docker could not start: ${result.error.message}`);
};

const fail = (message, { logs = true } = {}) => {
  console.error(`\nUpdate failed: ${message}`);
  if (logs) printBackendLogs();
  console.error(`\nData volumes were not touched. To return to the previous images run: ${rollbackHint}`);
  process.exit(1);
};

const main = async () => {
  let gitSha;
  try {
    assertProductionEnvironment();
    gitSha = assertCleanReleaseCheckout();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const timeoutMs = Number(process.env.UPDATE_PROD_HEALTH_TIMEOUT_MS) || defaultHealthTimeoutMs;

  console.log(`[update:prod] 1/3 Building production images for ${gitSha} (docker:build:prod).`);
  const build = runNode('scripts/docker-build-prod.mjs');
  if (build.error || build.status !== 0) {
    console.error('\nUpdate stopped: the build failed. Running containers were not changed.');
    process.exit(build.status || 1);
  }

  console.log(`\n[update:prod] 2/3 Starting production containers for ${gitSha} (docker:up:prod).`);
  const up = runNode('scripts/docker-up.mjs', ['--prod']);
  if (up.error || up.status !== 0) fail('docker:up:prod did not complete.');

  console.log(`\n[update:prod] 3/3 Waiting up to ${Math.round(timeoutMs / 1000)}s for /api/health (mongoOk=true, buildSha=${gitSha}).`);
  const health = await waitForHealthy({ expectedSha: gitSha, timeoutMs });
  if (!health.ok) {
    for (const result of health.results) console.error(`  ${result.url}: ${result.reason}`);
    fail('health check did not pass in time.');
  }

  spawnSync('docker', [...productionComposeArgs, 'ps'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: productionChildEnvironment(),
  });
  console.log(`\nUpdate complete: version ${gitSha} is running, MongoDB is reachable (mongoOk=true).`);
  for (const result of health.results) console.log(`  ${result.url}: ok`);
  console.log(`If something looks wrong in the app, roll back with: ${rollbackHint}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
