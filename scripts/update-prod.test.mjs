import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { productionEnvPath, projectRoot } from './production-env.mjs';
import { evaluateHealth, healthUrls, rollbackHint, waitForHealthy } from './update-prod.mjs';

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const fakeClock = () => {
  let current = 0;
  return { now: () => current, sleep: async (ms) => { current += ms; } };
};

test('evaluateHealth requires mongoOk true and the current buildSha', () => {
  assert.equal(evaluateHealth({ mongoOk: true, buildSha: 'abc1234' }, 'abc1234').ok, true);
  assert.equal(evaluateHealth({ mongoOk: false, buildSha: 'abc1234' }, 'abc1234').ok, false);
  const stale = evaluateHealth({ mongoOk: true, buildSha: 'old0000' }, 'abc1234');
  assert.equal(stale.ok, false);
  assert.match(stale.reason, /old0000.*abc1234/);
  assert.equal(evaluateHealth(null, 'abc1234').ok, false);
});

test('health is checked on backend loopback and through the frontend', () => {
  assert.deepEqual(healthUrls, [
    'http://127.0.0.1:5000/api/health',
    'http://127.0.0.1:5173/api/health',
  ]);
  assert.equal(rollbackHint, 'npm run docker:rollback:prod');
});

test('waitForHealthy polls until the new build reports healthy', async () => {
  const clock = fakeClock();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls <= 2) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
    if (calls <= 4) return jsonResponse({ mongoOk: true, buildSha: 'old0000' });
    return jsonResponse({ mongoOk: true, buildSha: 'abc1234' });
  };
  const result = await waitForHealthy({
    expectedSha: 'abc1234',
    urls: ['http://a', 'http://b'],
    fetchImpl,
    ...clock,
  });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
});

test('waitForHealthy gives up after the timeout and reports reasons', async () => {
  const clock = fakeClock();
  const result = await waitForHealthy({
    expectedSha: 'abc1234',
    urls: ['http://a'],
    timeoutMs: 90_000,
    intervalMs: 3_000,
    fetchImpl: async () => jsonResponse({ mongoOk: false, buildSha: 'abc1234' }),
    ...clock,
  });
  assert.equal(result.ok, false);
  assert.ok(clock.now() <= 90_000);
  assert.equal(result.attempts, 31);
  assert.match(result.results[0].reason, /mongoOk/);
});

test('waitForHealthy treats HTTP errors and non-JSON as unhealthy', async () => {
  const clock = fakeClock();
  const result = await waitForHealthy({
    expectedSha: 'abc1234',
    urls: ['http://a', 'http://b'],
    timeoutMs: 0,
    fetchImpl: async (url) =>
      url === 'http://a'
        ? jsonResponse({}, 502)
        : { ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } },
    ...clock,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.results.map((r) => r.reason), ['HTTP 502', 'response is not JSON']);
});

test('update script never pulls, downs, or rolls back on its own', () => {
  const source = readFileSync(new URL('./update-prod.mjs', import.meta.url), 'utf8');
  const code = source.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /'pull'|git pull/);
  assert.doesNotMatch(code, /'down'/);
  assert.doesNotMatch(code, /docker-rollback-prod\.mjs/);
});

test('package.json wires update:prod', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['update:prod'], 'node scripts/update-prod.mjs');
  assert.match(pkg.scripts['test:deployment'], /update-prod\.test\.mjs/);
});

test('update:prod refuses to run without .env.production', { skip: existsSync(productionEnvPath) }, () => {
  const result = spawnSync(process.execPath, ['scripts/update-prod.mjs'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\.env\.production/);
});
