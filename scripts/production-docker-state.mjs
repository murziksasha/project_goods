import { spawnSync } from 'node:child_process';
import { projectRoot } from './production-env.mjs';

const inspect = (args) => {
  const result = spawnSync('docker', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) {
    throw new Error('Cannot inspect the existing production Docker containers and volumes.');
  }
  return result.stdout.trim();
};

export const assertProductionDockerState = (
  config,
  { requireBackend = true, inspectDocker = inspect } = {},
) => {
  for (const volume of [config.mongoDataVolume, config.backupDataVolume]) {
    if (inspectDocker(['volume', 'inspect', volume, '--format', '{{.Name}}']) !== volume) {
      throw new Error(`The existing Docker volume ${volume} was not found.`);
    }
  }

  const projectFormat = '{{index .Config.Labels "com.docker.compose.project"}}';
  const mongoProject = inspectDocker(['inspect', '--format', projectFormat, 'project_goods_mongo']);
  if (mongoProject !== config.projectName) {
    throw new Error('The MongoDB container belongs to a different Compose project.');
  }

  const mongoMount = inspectDocker([
    'inspect',
    '--format',
    '{{range .Mounts}}{{if eq .Destination "/data/db"}}{{.Type}}:{{.Name}}{{end}}{{end}}',
    'project_goods_mongo',
  ]);
  if (mongoMount !== `volume:${config.mongoDataVolume}`) {
    throw new Error('The MongoDB container does not use the declared existing data volume.');
  }

  if (requireBackend) {
    const backendProject = inspectDocker([
      'inspect',
      '--format',
      projectFormat,
      'project_goods_backend',
    ]);
    if (backendProject !== config.projectName) {
      throw new Error('The backend container belongs to a different Compose project.');
    }
    const backupMount = inspectDocker([
      'inspect',
      '--format',
      '{{range .Mounts}}{{if eq .Destination "/app/backups"}}{{.Type}}:{{.Name}}{{end}}{{end}}',
      'project_goods_backend',
    ]);
    if (backupMount !== `volume:${config.backupDataVolume}`) {
      throw new Error('The backend container does not use the declared existing backup volume.');
    }
  }
};
