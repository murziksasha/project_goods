import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertRollbackImagesPresent,
  buildRollbackPlan,
  noAuthConfirmFlag,
  parseRollbackArgs,
  readImageBuildSha,
} from './docker-rollback-prod.mjs';
import {
  keyfileCheckArgs,
  noAuthRollbackComposeArgs,
  productionComposeArgs,
  rollbackComposeArgs,
} from './production-env.mjs';

const composeFiles = (args) => args.filter((_, i) => args[i - 1] === '-f');

test('default rollback keeps MongoDB auth: base + prod + rollback layers', () => {
  assert.deepEqual(parseRollbackArgs([]), { auth: true });
  assert.deepEqual(rollbackComposeArgs.slice(0, productionComposeArgs.length), productionComposeArgs);
  assert.deepEqual(composeFiles(rollbackComposeArgs), [
    'docker-compose.yml',
    'docker-compose.prod.yml',
    'docker-compose.rollback.yml',
  ]);
  const plan = buildRollbackPlan({ auth: true });
  assert.deepEqual(plan.composeArgs, rollbackComposeArgs);
  assert.deepEqual(plan.steps[0], [...rollbackComposeArgs, 'config', '-q']);
  assert.deepEqual(plan.steps[1], [...rollbackComposeArgs, ...keyfileCheckArgs]);
  const up = plan.steps.at(-1);
  for (const flag of ['up', '-d', '--no-build', '--force-recreate']) assert.ok(up.includes(flag));
  assert.deepEqual(up.slice(up.indexOf('--pull'), up.indexOf('--pull') + 2), ['--pull', 'never']);
  for (const step of plan.steps) {
    assert.ok(!step.includes('down'));
    assert.ok(!step.includes('-v'));
  }
});

test('no-auth rollback is explicit, confirmed, and never uses the prod layer', () => {
  assert.throws(() => parseRollbackArgs(['--noauth']), /WITHOUT access control[\s\S]*--confirm-noauth/);
  assert.throws(() => parseRollbackArgs([noAuthConfirmFlag]), /only valid with docker:rollback:noauth/);
  assert.throws(() => parseRollbackArgs(['--force']), /Unknown rollback option/);
  assert.deepEqual(parseRollbackArgs(['--noauth', noAuthConfirmFlag]), { auth: false });
  assert.deepEqual(composeFiles(noAuthRollbackComposeArgs), ['docker-compose.yml', 'docker-compose.rollback.yml']);
  const plan = buildRollbackPlan({ auth: false });
  assert.deepEqual(plan.composeArgs, noAuthRollbackComposeArgs);
  assert.equal(plan.steps.length, 2);
});

test('package.json wires both rollback commands and the test', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['docker:rollback:prod'], 'node scripts/docker-rollback-prod.mjs');
  assert.equal(pkg.scripts['docker:rollback:noauth'], 'node scripts/docker-rollback-prod.mjs --noauth');
  assert.match(pkg.scripts['test:deployment'], /docker-rollback-prod\.test\.mjs/);
});

test('rollback overlay only swaps images and pins volumes (no Mongo/auth overrides)', () => {
  const overlay = readFileSync(new URL('../docker-compose.rollback.yml', import.meta.url), 'utf8');
  const code = overlay.replace(/^\s*#.*$/gm, '');
  assert.match(code, /project-goods\/backend:rollback/);
  assert.match(code, /project-goods\/frontend:rollback/);
  assert.doesNotMatch(code, /^\s{2}mongo:/m);
  assert.doesNotMatch(code, /MONGO_URI|command:|keyFile/);
});

test('reads BUILD_SHA from the rollback image environment', () => {
  const inspect = (env) => () => JSON.stringify(env);
  assert.equal(readImageBuildSha('x', { inspectDocker: inspect(['PATH=/bin', 'BUILD_SHA=712e6d5']) }), '712e6d5');
  assert.equal(readImageBuildSha('x', { inspectDocker: inspect(['PATH=/bin']) }), null);
  assert.equal(readImageBuildSha('x', { inspectDocker: inspect(['BUILD_SHA=$(rm -rf /)']) }), null);
  assert.equal(readImageBuildSha('x', { inspectDocker: () => null }), null);
  assert.equal(readImageBuildSha('x', { inspectDocker: () => 'not json' }), null);
});

test('missing rollback images stop before any change', () => {
  assert.throws(
    () =>
      assertRollbackImagesPresent({
        inspectDocker: (args) => (args[2] === 'project-goods/frontend:rollback' ? null : 'sha256:x'),
      }),
    /Rollback image project-goods\/frontend:rollback not found/,
  );
  assert.doesNotThrow(() => assertRollbackImagesPresent({ inspectDocker: () => 'sha256:x' }));
});
