import { spawnSync } from 'node:child_process';
import { projectRoot } from './production-env.mjs';

const notFoundPattern = /no such (object|container|volume|image)/i;

export const isDockerNotFound = (stderr) => notFoundPattern.test(String(stderr ?? ''));

// Runs a read-only `docker` inspection. Returns trimmed stdout, or null when the
// object does not exist. Any other failure is reported with Docker's own stderr.
export const inspectDockerObject = (args, { run = spawnSync } = {}) => {
  const result = run('docker', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) {
    throw new Error(`Docker could not start (docker ${args.join(' ')}): ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    if (isDockerNotFound(stderr)) return null;
    throw new Error(
      `Docker inspection failed (docker ${args.join(' ')}): ${stderr || `exit code ${result.status}`}`,
    );
  }
  return String(result.stdout ?? '').trim();
};

const projectFormat = '{{index .Config.Labels "com.docker.compose.project"}}';
const mountFormat = (destination) =>
  `{{range .Mounts}}{{if eq .Destination "${destination}"}}{{.Type}}:{{.Name}}{{end}}{{end}}`;

const checkContainer = (inspectDocker, config, { container, label, destination, volume, kind }) => {
  const project = inspectDocker(['inspect', '--format', projectFormat, container]);
  if (project === null) return 'absent';
  if (project !== config.projectName) {
    throw new Error(`The ${label} container belongs to a different Compose project.`);
  }
  const mount = inspectDocker(['inspect', '--format', mountFormat(destination), container]);
  if (mount === null) return 'absent';
  if (mount !== `volume:${volume}`) {
    throw new Error(`The ${label} container does not use the declared existing ${kind} volume.`);
  }
  return 'present';
};

// Verifies that production will reuse the declared existing volumes.
// Existing containers must belong to this Compose project and mount those volumes.
// Absent containers are allowed (they will be recreated on the existing volumes).
// Returns { mongo, backend } with 'present' | 'absent' | 'skipped'.
export const assertProductionDockerState = (
  config,
  { requireBackend = true, inspectDocker = inspectDockerObject } = {},
) => {
  for (const volume of [config.mongoDataVolume, config.backupDataVolume]) {
    if (inspectDocker(['volume', 'inspect', volume, '--format', '{{.Name}}']) !== volume) {
      throw new Error(`The existing Docker volume ${volume} was not found.`);
    }
  }

  const mongo = checkContainer(inspectDocker, config, {
    container: 'project_goods_mongo',
    label: 'MongoDB',
    destination: '/data/db',
    volume: config.mongoDataVolume,
    kind: 'data',
  });

  const backend = requireBackend
    ? checkContainer(inspectDocker, config, {
        container: 'project_goods_backend',
        label: 'backend',
        destination: '/app/backups',
        volume: config.backupDataVolume,
        kind: 'backup',
      })
    : 'skipped';

  return { mongo, backend };
};

export const describeAbsentContainers = (state) =>
  Object.entries({ project_goods_mongo: state.mongo, project_goods_backend: state.backend })
    .filter(([, status]) => status === 'absent')
    .map(([name]) => name);

const imageIdPattern = /^sha256:[a-f0-9]{64}$/;

// Resolves the images of existing containers that should be tagged for rollback.
// Absent containers are reported as skipped so a first start after container
// removal can still build; a container with an unreadable image id is an error.
export const collectRollbackImages = (pairs, { inspectDocker = inspectDockerObject } = {}) => {
  const tag = [];
  const skipped = [];
  for (const [container, rollbackImage] of pairs) {
    const imageId = inspectDocker(['inspect', '--format', '{{.Image}}', container]);
    if (imageId === null) {
      skipped.push(container);
      continue;
    }
    if (!imageIdPattern.test(imageId)) {
      throw new Error(`Cannot identify the running ${container} image for rollback.`);
    }
    tag.push({ container, imageId, rollbackImage });
  }
  return { tag, skipped };
};
