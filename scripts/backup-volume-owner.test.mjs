import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  BACKUP_OWNER,
  NEEDS_MIGRATION_STATUS,
  buildVolumeRunArgs,
  checkScript,
  inspectBackupVolume,
  migrateBackupVolumeOwner,
  migrateScript,
  resolveComposeBackupVolume,
} from './backup-volume-owner.mjs';

// Source assertions must work in both LF and Windows CRLF checkouts.
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const silent = () => {};

const fakeDocker = (statuses) => {
  const calls = [];
  return {
    calls,
    run: (args) => {
      calls.push(args);
      const mode = args.includes(migrateScript) ? 'migrate' : 'check';
      const next = statuses[mode].shift();
      return next ?? { status: 0, stdout: '' };
    },
  };
};

const volumeInspect = (label = 'project_goods') => (args) => {
  assert.deepEqual(args.slice(0, 3), ['volume', 'inspect', 'project_goods_backup-data']);
  return `project_goods_backup-data|${label}`;
};

test('one-off container is isolated: no network, no pull, minimal capabilities, only the backup volume', () => {
  for (const mode of ['check', 'migrate']) {
    const args = buildVolumeRunArgs('project_goods_backup-data', mode);
    assert.deepEqual(args.slice(0, 2), ['run', '--rm']);
    assert.deepEqual(args.slice(args.indexOf('--pull'), args.indexOf('--pull') + 2), ['--pull', 'never']);
    assert.deepEqual(args.slice(args.indexOf('--network'), args.indexOf('--network') + 2), ['--network', 'none']);
    assert.ok(!args.includes('-p') && !args.includes('--publish'));
    assert.deepEqual(args.slice(args.indexOf('--cap-drop'), args.indexOf('--cap-drop') + 2), ['--cap-drop', 'ALL']);
    assert.ok(args.includes('no-new-privileges:true'));
    const mounts = args.filter((_, i) => args[i - 1] === '--mount' || args[i - 1] === '-v');
    assert.deepEqual(mounts, ['type=volume,source=project_goods_backup-data,target=/backups']);
    assert.ok(args.includes('mongo:7'));
    const caps = args.filter((_, i) => args[i - 1] === '--cap-add');
    assert.deepEqual(caps, mode === 'migrate' ? ['CHOWN', 'DAC_OVERRIDE', 'FOWNER'] : ['DAC_READ_SEARCH']);
  }
  assert.throws(() => buildVolumeRunArgs('bad name;rm', 'check'), /Invalid backup volume name/);
});

test('check covers the whole tree (yearly/, .restore-*) and migration only touches owner bits', () => {
  assert.match(checkScript, /find \/backups -xdev/);
  assert.match(checkScript, /! -uid 1000 -o ! -gid 1000/);
  assert.match(checkScript, new RegExp(`exit ${NEEDS_MIGRATION_STATUS}`));
  assert.equal(migrateScript, `chown -R ${BACKUP_OWNER} /backups && chmod -R u+rwX /backups`);
  assert.doesNotMatch(migrateScript, /\brm\b|\bmv\b/);
});

test('already migrated volume: no stop, no chown', () => {
  const docker = fakeDocker({ check: [{ status: 0 }], migrate: [] });
  let stopped = false;
  const result = migrateBackupVolumeOwner({
    volumeName: 'project_goods_backup-data',
    projectName: 'project_goods',
    stopBackend: () => {
      stopped = true;
    },
    runDocker: docker.run,
    inspectDocker: volumeInspect(),
    log: silent,
  });
  assert.equal(result, 'unchanged');
  assert.equal(stopped, false);
  assert.equal(docker.calls.length, 1);
  assert.ok(!docker.calls[0].includes(migrateScript));
});

test('root-owned volume: stop backend, chown, re-check', () => {
  const order = [];
  const docker = fakeDocker({
    check: [{ status: NEEDS_MIGRATION_STATUS, stdout: '42\n' }, { status: 0 }],
    migrate: [{ status: 0 }],
  });
  const logs = [];
  const result = migrateBackupVolumeOwner({
    volumeName: 'project_goods_backup-data',
    projectName: 'project_goods',
    stopBackend: () => order.push('stop'),
    runDocker: (args) => {
      order.push(args.includes(migrateScript) ? 'migrate' : 'check');
      return docker.run(args);
    },
    inspectDocker: volumeInspect(),
    log: (line) => logs.push(line),
  });
  assert.equal(result, 'migrated');
  assert.deepEqual(order, ['check', 'stop', 'migrate', 'check']);
  assert.match(logs.join('\n'), /42 entries/);
});

test('a volume of another Compose project is refused without changes', () => {
  const docker = fakeDocker({ check: [], migrate: [] });
  assert.throws(
    () =>
      migrateBackupVolumeOwner({
        volumeName: 'project_goods_backup-data',
        projectName: 'project_goods',
        runDocker: docker.run,
        inspectDocker: volumeInspect('pricelens'),
        log: silent,
      }),
    /belongs to Compose project "pricelens"/,
  );
  assert.equal(docker.calls.length, 0);
});

test('unlabelled external volume is accepted; missing volume fails unless allowed', () => {
  assert.deepEqual(inspectBackupVolume('v', { inspectDocker: () => 'v|' }), { label: '' });
  assert.deepEqual(inspectBackupVolume('v', { inspectDocker: () => 'v|<no value>' }), { label: '' });
  const docker = fakeDocker({ check: [], migrate: [] });
  assert.throws(
    () =>
      migrateBackupVolumeOwner({
        volumeName: 'missing',
        projectName: 'project_goods',
        runDocker: docker.run,
        inspectDocker: () => null,
        log: silent,
      }),
    /was not found/,
  );
  assert.equal(
    migrateBackupVolumeOwner({
      volumeName: 'missing',
      projectName: 'project_goods',
      allowMissing: true,
      runDocker: docker.run,
      inspectDocker: () => null,
      log: silent,
    }),
    'skipped',
  );
  assert.equal(docker.calls.length, 0);
});

test('failed chown or leftover entries stop the start', () => {
  const base = {
    volumeName: 'project_goods_backup-data',
    projectName: 'project_goods',
    inspectDocker: volumeInspect(),
    log: silent,
  };
  assert.throws(
    () =>
      migrateBackupVolumeOwner({
        ...base,
        runDocker: fakeDocker({ check: [{ status: NEEDS_MIGRATION_STATUS, stdout: '1' }], migrate: [{ status: 1, stderr: 'denied' }] }).run,
      }),
    /ownership migration failed .*denied/,
  );
  assert.throws(
    () =>
      migrateBackupVolumeOwner({
        ...base,
        runDocker: fakeDocker({
          check: [{ status: NEEDS_MIGRATION_STATUS, stdout: '3' }, { status: NEEDS_MIGRATION_STATUS, stdout: '2' }],
          migrate: [{ status: 0 }],
        }).run,
      }),
    /2 entries are still not owned/,
  );
  assert.throws(
    () => migrateBackupVolumeOwner({ ...base, runDocker: () => ({ status: 125, stderr: 'No such image' }) }),
    /ownership check failed/,
  );
});

test('local Compose volume name is resolved from compose config JSON', () => {
  assert.deepEqual(
    resolveComposeBackupVolume(JSON.stringify({ name: 'project_goods', volumes: { 'backup-data': { name: 'project_goods_backup-data' } } })),
    { volumeName: 'project_goods_backup-data', projectName: 'project_goods' },
  );
  assert.throws(() => resolveComposeBackupVolume('{}'), /no backup-data volume/);
});

test('docker:up:prod migrates after the keyfile check and before starting containers', () => {
  const source = read('./docker-up.mjs');
  const keyfile = source.indexOf("'check MongoDB keyfile volume'");
  const migrate = source.indexOf('if (production) {\n  migrateBackupVolume();');
  const up = source.indexOf("production ? 'start production containers'");
  assert.ok(keyfile > 0 && migrate > keyfile && up > migrate);
  assert.match(source, /'stop', 'backend'/);
  // update:prod and mongo:users:init:prod reuse docker-up.mjs --prod.
  assert.match(read('./update-prod.mjs'), /runNode\('scripts\/docker-up\.mjs', \['--prod'\]\)/);
  assert.match(read('./mongo-users-init-prod.mjs'), /runNode\('scripts\/docker-up\.mjs', \['--prod'\]\)/);
});

test('rollback migrates before starting the rollback containers', () => {
  const source = read('./docker-rollback-prod.mjs');
  const migrate = source.indexOf('migrateBackupVolumeOwner({');
  const up = source.indexOf('runDocker(upStep');
  assert.ok(migrate > 0 && up > migrate);
});

test('production Compose limits and hardening', () => {
  const prod = read('../docker-compose.prod.yml').replace(/^\s*#.*$/gm, '');
  const service = (name) => {
    const match = prod.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  \\S|^\\S)`, 'm'));
    assert.ok(match, `${name} service exists`);
    return match[1];
  };
  const mongo = service('mongo');
  assert.match(mongo, /--wiredTigerCacheSizeGB\n\s+- "1"/);
  assert.match(mongo, /mem_limit: 2g/);
  assert.doesNotMatch(mongo, /cap_drop|user:/);
  for (const [name, mem] of [['backend', '6g'], ['frontend', '128m']]) {
    const block = service(name);
    assert.match(block, new RegExp(`mem_limit: ${mem}`));
    assert.match(block, /pids_limit: 200/);
    assert.match(block, /cap_drop: \[ALL\]/);
    assert.match(block, /no-new-privileges:true/);
    assert.match(block, /CSP_REPORT_ONLY: \$\{CSP_REPORT_ONLY:-true\}/);
  }
  assert.match(service('frontend'), /read_only: true\n\s+tmpfs:\n\s+- \/tmp/);
  assert.doesNotMatch(service('backend'), /read_only/);
  const keyfileInit = service('mongo-keyfile-init');
  assert.doesNotMatch(keyfileInit, /cap_drop|mem_limit/);
});

test('rollback overlay runs backend and frontend as 1000:1000', () => {
  const overlay = read('../docker-compose.rollback.yml').replace(/^\s*#.*$/gm, '');
  const users = overlay.match(/user: "1000:1000"/g) ?? [];
  assert.equal(users.length, 2);
});

test('Dockerfiles run as node and keep backup tools', () => {
  const backend = read('../backend/Dockerfile');
  const frontend = read('../frontend/Dockerfile');
  for (const file of [backend, frontend]) {
    assert.match(file, /^USER node$/m);
    assert.doesNotMatch(file, /^COPY \. \.$/m);
  }
  assert.match(backend, /COPY --from=mongo-tools \/usr\/bin\/mongodump/);
  assert.match(backend, /COPY --from=mongo-tools \/usr\/bin\/mongorestore/);
  assert.match(backend, /libgssapi-krb5-2/);
  assert.match(backend, /curl/);
  assert.match(backend, /npm ci --omit=dev/);
  assert.match(backend, /chown -R node:node \/app\/backups/);
  assert.match(frontend, /node_modules\/helmet/);
});

test('package.json wires the test into test:deployment and drops project_goods file:..', () => {
  const pkg = JSON.parse(read('../package.json'));
  assert.match(pkg.scripts['test:deployment'], /backup-volume-owner\.test\.mjs/);
  for (const path of ['../backend/package.json', '../frontend/package.json']) {
    const deps = JSON.parse(read(path)).dependencies;
    assert.equal(deps.project_goods, undefined);
  }
  assert.ok(JSON.parse(read('../frontend/package.json')).dependencies.helmet);
});
