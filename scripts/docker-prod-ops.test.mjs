import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { buildProductionOpsArgs } from './docker-prod-ops.mjs';
import { productionComposeArgs, productionEnvPath } from './production-env.mjs';

test('stop uses compose stop and never down', () => {
  const args = buildProductionOpsArgs('stop');
  assert.deepEqual(args, [...productionComposeArgs, 'stop']);
  assert.ok(!args.includes('down'));
  assert.throws(() => buildProductionOpsArgs('stop', ['-v']));
});

test('logs follows last 200 lines and accepts service names', () => {
  assert.deepEqual(buildProductionOpsArgs('logs'), [...productionComposeArgs, 'logs', '-f', '--tail=200']);
  assert.deepEqual(buildProductionOpsArgs('logs', ['backend']), [
    ...productionComposeArgs, 'logs', '-f', '--tail=200', 'backend',
  ]);
  assert.deepEqual(buildProductionOpsArgs('logs', ['backend', '--no-follow']), [
    ...productionComposeArgs, 'logs', '--tail=200', 'backend',
  ]);
});

test('rejects unknown actions and unsafe arguments', () => {
  assert.throws(() => buildProductionOpsArgs('down'));
  assert.throws(() => buildProductionOpsArgs('logs', ['-v']));
  assert.throws(() => buildProductionOpsArgs('logs', ['backend;rm']));
});

test('refuses to run without .env.production', { skip: existsSync(productionEnvPath) }, () => {
  const result = spawnSync(process.execPath, ['scripts/docker-prod-ops.mjs', 'stop'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\.env\.production/);
});
