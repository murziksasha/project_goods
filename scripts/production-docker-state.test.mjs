import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertImagesPresent,
  assertProductionDockerState,
  collectRollbackImages,
  describeAbsentContainers,
  inspectDockerObject,
  missingImageMessage,
} from './production-docker-state.mjs';

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

const withoutContainers = (absent) => (args) => {
  if (args[0] === 'inspect' && absent.includes(args[args.length - 1])) return null;
  return inspectDocker(args);
};

test('reports existing containers as present', () => {
  assert.deepEqual(assertProductionDockerState(config, { inspectDocker }), {
    mongo: 'present',
    backend: 'present',
  });
});

test('allows bootstrap when containers are absent but both volumes exist', () => {
  const state = assertProductionDockerState(config, {
    inspectDocker: withoutContainers(['project_goods_mongo', 'project_goods_backend']),
  });
  assert.deepEqual(state, { mongo: 'absent', backend: 'absent' });
  assert.deepEqual(describeAbsentContainers(state), [
    'project_goods_mongo',
    'project_goods_backend',
  ]);
});

test('allows only one container to be absent and still checks the other', () => {
  assert.deepEqual(
    assertProductionDockerState(config, {
      inspectDocker: withoutContainers(['project_goods_backend']),
    }),
    { mongo: 'present', backend: 'absent' },
  );
  assert.throws(
    () =>
      assertProductionDockerState(config, {
        inspectDocker: (args) => {
          if (args.at(-1) === 'project_goods_mongo') return null;
          if (args.at(-1) === 'project_goods_backend' && args[2].includes('Mounts')) {
            return 'volume:some_other_volume';
          }
          return inspectDocker(args);
        },
      }),
    /backend container does not use the declared existing backup volume/,
  );
});

test('rollback mode skips the backend container entirely', () => {
  assert.deepEqual(
    assertProductionDockerState(config, {
      requireBackend: false,
      inspectDocker: withoutContainers(['project_goods_mongo']),
    }),
    { mongo: 'absent', backend: 'skipped' },
  );
});

test('rejects a container from another project or with a wrong volume', () => {
  assert.throws(
    () =>
      assertProductionDockerState(config, {
        inspectDocker: (args) =>
          args[2]?.includes('Labels') && args.at(-1) === 'project_goods_mongo'
            ? 'another_project'
            : inspectDocker(args),
      }),
    /MongoDB container belongs to a different Compose project/,
  );
  assert.throws(
    () =>
      assertProductionDockerState(config, {
        inspectDocker: (args) =>
          args[2]?.includes('Mounts') && args.at(-1) === 'project_goods_mongo'
            ? ''
            : inspectDocker(args),
      }),
    /MongoDB container does not use the declared existing data volume/,
  );
});

test('refuses to start when a declared volume is missing, even without containers', () => {
  for (const missing of ['project_goods_mongo-data', 'project_goods_backup-data']) {
    assert.throws(
      () =>
        assertProductionDockerState(config, {
          inspectDocker: (args) =>
            args[0] === 'volume' && args[2] === missing
              ? null
              : withoutContainers(['project_goods_mongo', 'project_goods_backend'])(args),
        }),
      new RegExp(`The existing Docker volume ${missing} was not found\\.`),
    );
  }
});

const fakeRun = (result) => () => ({ status: 0, stdout: '', stderr: '', ...result });

test('inspectDockerObject returns trimmed stdout on success', () => {
  assert.equal(
    inspectDockerObject(['volume', 'inspect', 'x'], { run: fakeRun({ stdout: 'x\n' }) }),
    'x',
  );
});

test('inspectDockerObject returns null for missing Docker objects', () => {
  for (const stderr of [
    'Error: No such object: project_goods_mongo',
    'Error response from daemon: No such container: project_goods_backend',
    'Error response from daemon: get project_goods_mongo-data: no such volume',
  ]) {
    assert.equal(inspectDockerObject(['inspect', 'x'], { run: fakeRun({ status: 1, stderr }) }), null);
  }
});

test('inspectDockerObject surfaces the real Docker error', () => {
  assert.throws(
    () =>
      inspectDockerObject(['inspect', 'project_goods_mongo'], {
        run: fakeRun({
          status: 1,
          stderr: 'error during connect: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.',
        }),
      }),
    /Docker inspection failed \(docker inspect project_goods_mongo\): error during connect/,
  );
  assert.throws(
    () =>
      inspectDockerObject(['inspect', 'x'], {
        run: () => ({ error: new Error('spawn docker ENOENT') }),
      }),
    /Docker could not start .*spawn docker ENOENT/,
  );
});

test('rollback image collection skips absent containers', () => {
  const imageId = `sha256:${'a'.repeat(64)}`;
  const result = collectRollbackImages(
    [
      ['project_goods_backend', 'rollback/backend'],
      ['project_goods_frontend', 'rollback/frontend'],
    ],
    { inspectDocker: (args) => (args.at(-1) === 'project_goods_backend' ? imageId : null) },
  );
  assert.deepEqual(result, {
    tag: [{ container: 'project_goods_backend', imageId, rollbackImage: 'rollback/backend' }],
    skipped: ['project_goods_frontend'],
  });
  assert.deepEqual(
    collectRollbackImages([['project_goods_backend', 'r']], { inspectDocker: () => null }),
    { tag: [], skipped: ['project_goods_backend'] },
  );
  assert.throws(
    () => collectRollbackImages([['project_goods_backend', 'r']], { inspectDocker: () => 'garbage' }),
    /Cannot identify the running project_goods_backend image for rollback/,
  );
});

test('missing commit image gives a clear docker:build:prod hint', () => {
  assert.equal(
    missingImageMessage('project-goods/backend:6564f56'),
    'Image project-goods/backend:6564f56 not found. Run npm run docker:build:prod first.',
  );
  const seen = [];
  const inspect = (args) => {
    seen.push(args);
    return args[2] === 'project-goods/frontend:6564f56' ? null : 'sha256:x';
  };
  assert.throws(
    () => assertImagesPresent(['project-goods/backend:6564f56', 'project-goods/frontend:6564f56'], { inspectDocker: inspect }),
    { message: 'Image project-goods/frontend:6564f56 not found. Run npm run docker:build:prod first.' },
  );
  assert.deepEqual(seen[0], ['image', 'inspect', 'project-goods/backend:6564f56', '--format', '{{.Id}}']);
});

test('present images pass and real Docker errors are not hidden', () => {
  assert.doesNotThrow(() => assertImagesPresent(['a:1', 'b:1'], { inspectDocker: () => 'sha256:x' }));
  const run = () => ({ status: 1, stdout: '', stderr: 'Error: No such image: project-goods/backend:abc' });
  assert.equal(inspectDockerObject(['image', 'inspect', 'project-goods/backend:abc'], { run }), null);
  assert.throws(
    () => assertImagesPresent(['a:1'], { inspectDocker: () => { throw new Error('Docker inspection failed: daemon down'); } }),
    /daemon down/,
  );
});

test('docker:up:prod pre-checks images before compose up', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('./docker-up.mjs', import.meta.url), 'utf8');
  const check = source.indexOf('assertImagesPresent(productionImageRefs(gitSha))');
  assert.ok(check > 0);
  assert.ok(check < source.indexOf("'up',"));
});
