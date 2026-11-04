import { spawnSync } from 'node:child_process';
import {
  assertProductionVolumeEnvironment,
  productionChildEnvironment,
  projectRoot,
  rollbackComposeArgs,
  rollbackImageRefs,
} from './production-env.mjs';
import {
  assertProductionDockerState,
  describeAbsentContainers,
} from './production-docker-state.mjs';

try {
  const absent = describeAbsentContainers(
    assertProductionDockerState(assertProductionVolumeEnvironment(), { requireBackend: false }),
  );
  if (absent.length > 0) {
    console.log(`Containers not found (will be created on the existing volumes): ${absent.join(', ')}.`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const runDocker = (args) => {
  const result = spawnSync('docker', args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: productionChildEnvironment(),
  });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? 'Docker command failed.');
    process.exit(result.status || 1);
  }
};

for (const imageRef of rollbackImageRefs) {
  runDocker(['image', 'inspect', imageRef, '--format', '{{.Id}}']);
}
runDocker(['image', 'inspect', 'mongo:7', '--format', '{{.Id}}']);
runDocker([...rollbackComposeArgs, 'config', '-q']);
runDocker([
  ...rollbackComposeArgs,
  'up',
  '-d',
  '--no-build',
  '--pull',
  'never',
  '--force-recreate',
  'mongo',
  'backend',
  'frontend',
]);
console.log('Rollback stack started. Confirm MongoDB and backend health before reopening shop access.');
