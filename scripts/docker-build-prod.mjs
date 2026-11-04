import { spawnSync } from 'node:child_process';
import {
  assertProductionEnvironment,
  productionChildEnvironment,
  productionComposeArgs,
  productionImageRefs,
  projectRoot,
  rollbackImageRefs,
} from './production-env.mjs';
import { assertProductionDockerState } from './production-docker-state.mjs';
import { assertCleanReleaseCheckout } from './production-git-state.mjs';

try {
  assertProductionDockerState(assertProductionEnvironment());
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
for (const [container, rollbackImage] of [
  ['project_goods_backend', rollbackImageRefs[0]],
  ['project_goods_frontend', rollbackImageRefs[1]],
]) {
  const imageId = runDocker(['inspect', '--format', '{{.Image}}', container], true);
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) {
    console.error(`Cannot identify the running ${container} image for rollback.`);
    process.exit(1);
  }
  runDocker(['image', 'tag', imageId, rollbackImage]);
}

console.log(`Saved running images for rollback; building production images for ${gitSha}.`);
runDocker([...productionComposeArgs, 'build', 'backend', 'frontend']);
for (const imageRef of productionImageRefs(gitSha)) {
  runDocker(['image', 'inspect', imageRef, '--format', '{{.Id}}']);
}
console.log('Production images are built. Running containers were not restarted.');
