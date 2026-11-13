import { spawnSync } from 'node:child_process';
import {
  assertProductionEnvironment,
  productionChildEnvironment,
  productionComposeArgs,
  productionImageRefs,
  projectRoot,
  rollbackImageRefs,
} from './production-env.mjs';
import {
  assertProductionDockerState,
  collectRollbackImages,
  describeAbsentContainers,
} from './production-docker-state.mjs';
import { assertCleanReleaseCheckout } from './production-git-state.mjs';

try {
  const absent = describeAbsentContainers(assertProductionDockerState(assertProductionEnvironment()));
  if (absent.length > 0) {
    console.log(`Containers not found (will be created on the existing volumes): ${absent.join(', ')}.`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const gitSha = assertCleanReleaseCheckout();
const environment = productionChildEnvironment({
  GIT_SHA: gitSha,
  DOCKER_BUILDKIT: '1',
  COMPOSE_DOCKER_CLI_BUILD: '1',
});

const runDocker = (args, capture = false) => {
  const result = spawnSync('docker', args, {
    cwd: projectRoot,
    env: environment,
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? 'Docker command failed.');
    process.exit(result.status || 1);
  }
  return capture ? result.stdout.trim() : '';
};

runDocker([...productionComposeArgs, 'config', '-q']);
let rollback;
try {
  rollback = collectRollbackImages([
    ['project_goods_backend', rollbackImageRefs[0]],
    ['project_goods_frontend', rollbackImageRefs[1]],
  ]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
for (const { imageId, rollbackImage } of rollback.tag) {
  runDocker(['image', 'tag', imageId, rollbackImage]);
}
if (rollback.skipped.length > 0) {
  console.log(
    `No existing container for ${rollback.skipped.join(', ')}; rollback tags for them were left unchanged.`,
  );
}

console.log(
  `${rollback.tag.length > 0 ? 'Saved running images for rollback; b' : 'B'}uilding production images for ${gitSha}.`,
);
runDocker([...productionComposeArgs, 'build', 'backend', 'frontend']);
for (const imageRef of productionImageRefs(gitSha)) {
  runDocker(['image', 'inspect', imageRef, '--format', '{{.Id}}']);
}
console.log('Production images are built. Running containers were not restarted.');
