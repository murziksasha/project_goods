import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProductionDockerState } from './production-docker-state.mjs';

const config = {
  projectName: 'project_goods',
  mongoDataVolume: 'project_goods_mongo-data',
  backupDataVolume: 'project_goods_backup-data',
};

const inspectDocker = (args) => {
  if (args[0] === 'volume') return args[2];
  if (args[2].includes('Labels')) return 'project_goods';
  if (args[3] === 'project_goods_mongo') return 'volume:project_goods_mongo-data';
  if (args[3] === 'project_goods_backend') return 'volume:project_goods_backup-data';
  throw new Error('Unexpected Docker inspection.');
};

test('accepts the existing project and exact named volume mounts', () => {
  assert.doesNotThrow(() => assertProductionDockerState(config, { inspectDocker }));
});

test('rejects a volume mismatch before a production cutover', () => {
  assert.throws(() =>
    assertProductionDockerState(
      { ...config, mongoDataVolume: 'new_empty_mongo_data' },
      { inspectDocker },
    ),
  );
  assert.throws(() =>
    assertProductionDockerState(config, {
      inspectDocker: (args) =>
        args[2]?.includes('Labels') ? 'another_project' : inspectDocker(args),
    }),
  );
});
