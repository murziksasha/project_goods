import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertLocalDevelopmentHost,
  parseProductionConfig,
  parseProductionVolumeConfig,
  parseProductionMongoUri,
  productionImageRefs,
} from './production-env.mjs';
import { assertCleanStatus } from './production-git-state.mjs';

const validUri =
  'mongodb://project_goods_app:a_long_url_safe_secret@mongo:27017/inventory?authSource=inventory&replicaSet=rs0';
const validConfig = [
  'COMPOSE_PROJECT_NAME=project_goods',
  'MONGO_DATA_VOLUME=project_goods_mongo-data',
  'BACKUP_DATA_VOLUME=project_goods_backup-data',
  `MONGO_URI=${validUri}`,
].join('\n');

test('accepts one authenticated inventory URI from the private file', () => {
  assert.equal(parseProductionMongoUri(`MONGO_URI=${validUri}\n`), validUri);
  assert.equal(parseProductionMongoUri(`MONGO_URI="${validUri}"\r\n`), validUri);
});

test('rejects a missing, duplicate, or example URI', () => {
  assert.throws(() => parseProductionMongoUri('CLIENT_ORIGIN=http://localhost:5173'));
  assert.throws(() => parseProductionMongoUri(`MONGO_URI=${validUri}\nMONGO_URI=${validUri}`));
  assert.throws(() =>
    parseProductionMongoUri(
      'MONGO_URI=mongodb://project_goods_app:REPLACE_WITH_PASSWORD@mongo:27017/inventory?authSource=inventory&replicaSet=rs0',
    ),
  );
});

test('rejects unauthenticated or wrong-database URIs', () => {
  assert.throws(() =>
    parseProductionMongoUri('MONGO_URI=mongodb://mongo:27017/inventory?replicaSet=rs0'),
  );
  assert.throws(() =>
    parseProductionMongoUri(`MONGO_URI=${validUri.replace('/inventory?', '/other?')}`),
  );
  assert.throws(() =>
    parseProductionMongoUri(`MONGO_URI=${validUri.replace('@mongo:', '@example.com:')}`),
  );
  assert.throws(() =>
    parseProductionMongoUri(`MONGO_URI=${validUri.replace('@mongo:27017', '@mongo:27018')}`),
  );
  assert.throws(() =>
    parseProductionMongoUri(`MONGO_URI=${validUri.replace('project_goods_app:', 'admin:')}`),
  );
});

test('refuses local Docker commands when the production marker exists', () => {
  assert.doesNotThrow(() => assertLocalDevelopmentHost(() => false));
  assert.throws(() => assertLocalDevelopmentHost(() => true), /docker:up:prod/);
});

test('uses commit-specific production image tags', () => {
  assert.deepEqual(productionImageRefs('482400f'), [
    'project-goods/backend:482400f',
    'project-goods/frontend:482400f',
  ]);
});

test('requires the existing production project and distinct data volumes', () => {
  assert.deepEqual(parseProductionConfig(validConfig), {
    projectName: 'project_goods',
    mongoDataVolume: 'project_goods_mongo-data',
    backupDataVolume: 'project_goods_backup-data',
    mongoUri: validUri,
  });
  assert.deepEqual(parseProductionVolumeConfig(validConfig), {
    projectName: 'project_goods',
    mongoDataVolume: 'project_goods_mongo-data',
    backupDataVolume: 'project_goods_backup-data',
  });
  assert.throws(() => parseProductionConfig(validConfig.replace('COMPOSE_PROJECT_NAME=', 'PROJECT=')));
  assert.throws(() =>
    parseProductionConfig(validConfig.replace('BACKUP_DATA_VOLUME=project_goods_backup-data', 'BACKUP_DATA_VOLUME=project_goods_mongo-data')),
  );
});

test('keeps private env files out of Git and Docker build contexts', () => {
  const gitignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  const dockerignore = readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8');
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^\*\*\/\.env\.\*$/m);
  assert.match(dockerignore, /^\.grill$/m);
});

test('requires a clean release checkout before tagging production images', () => {
  assert.doesNotThrow(() => assertCleanStatus(''));
  assert.throws(() => assertCleanStatus(' M docker-compose.yml\n'));
  assert.throws(() => assertCleanStatus('?? local-notes.txt\n'));
});
