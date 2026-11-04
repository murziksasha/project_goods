import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEYFILE_MISSING_STATUS,
  KEYFILE_PERMISSIONS_STATUS,
  describeKeyfileCheckFailure,
  dockerStepFailureMessage,
  keyfileCheckArgs,
  keyfileVolumeName,
  productionComposeArgs,
} from './production-env.mjs';
import { rollbackStepName } from './docker-rollback-prod.mjs';

const keyfileArgs = [...productionComposeArgs, ...keyfileCheckArgs];

test('keyfile check script uses distinct exit codes for missing vs permissions', () => {
  const script = keyfileCheckArgs.at(-1);
  assert.match(script, /test -s \/run\/mongo-keyfile\/keyfile \|\| exit 10/);
  assert.equal((script.match(/\|\| exit 11/g) || []).length, 2);
});

test('missing keyfile message names volume, prepare command and auth docs', () => {
  const message = describeKeyfileCheckFailure(KEYFILE_MISSING_STATUS, 'project_goods_mongo-keyfile');
  assert.match(message, /not found \(missing or empty\) in volume project_goods_mongo-keyfile/);
  assert.match(message, /npm run mongo:keyfile:prepare:prod/);
  assert.match(message, /project_goods_admin and project_goods_app/);
  assert.match(message, /DOCUMENTATION\/DEPLOYMENT\.md \(enabling auth\)/);
});

test('wrong permissions message is distinct', () => {
  const message = describeKeyfileCheckFailure(KEYFILE_PERMISSIONS_STATUS, 'x_mongo-keyfile');
  assert.match(message, /wrong permissions or owner in volume x_mongo-keyfile/);
  assert.match(message, /mongo:keyfile:prepare:prod/);
});

test('other keyfile check status falls back to combined message', () => {
  assert.match(describeKeyfileCheckFailure(1, 'v'), /not found or has wrong permissions in volume v .*status 1/);
});

test('dockerStepFailureMessage: success returns null', () => {
  assert.equal(dockerStepFailureMessage('s', keyfileArgs, { status: 0 }, 'project_goods'), null);
});

test('dockerStepFailureMessage: keyfile step failure explains keyfile with volume name', () => {
  const message = dockerStepFailureMessage('check', keyfileArgs, { status: 10 }, 'project_goods');
  assert.match(message, /volume project_goods_mongo-keyfile/);
  assert.equal(keyfileVolumeName('shop'), 'shop_mongo-keyfile');
});

test('dockerStepFailureMessage: other steps name the step and status', () => {
  const message = dockerStepFailureMessage('validate Compose configuration', [...productionComposeArgs, 'config', '-q'], { status: 15 }, 'p');
  assert.match(message, /Step failed: validate Compose configuration .*status 15/);
  const spawnError = dockerStepFailureMessage('start', ['up'], { error: new Error('ENOENT'), status: null }, 'p');
  assert.match(spawnError, /Step failed: start\. Docker could not start: ENOENT/);
});

test('rollback steps get readable names', () => {
  assert.equal(rollbackStepName(keyfileArgs), 'check MongoDB keyfile volume');
  assert.equal(rollbackStepName([...productionComposeArgs, 'config', '-q']), 'validate Compose configuration');
  assert.equal(rollbackStepName([...productionComposeArgs, 'up', '-d']), 'start rollback containers');
});
