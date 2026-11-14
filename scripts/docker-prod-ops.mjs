import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertProductionVolumeEnvironment,
  productionChildEnvironment,
  productionComposeArgs,
  projectRoot,
} from './production-env.mjs';

const serviceName = /^[a-z0-9][a-z0-9_-]*$/;

// Builds docker compose args for safe production operations. Never uses `down`.
export const buildProductionOpsArgs = (action, extra = []) => {
  if (action === 'stop') {
    if (extra.length > 0) throw new Error('docker:stop:prod does not accept arguments.');
    return [...productionComposeArgs, 'stop'];
  }
  if (action === 'logs') {
    const services = [];
    const flags = [];
    for (const arg of extra) {
      if (arg === '--no-follow') flags.push('--no-follow');
      else if (serviceName.test(arg)) services.push(arg);
      else throw new Error(`Unsupported docker:logs:prod argument: ${arg}`);
    }
    const follow = flags.includes('--no-follow') ? [] : ['-f'];
    return [...productionComposeArgs, 'logs', ...follow, '--tail=200', ...services];
  }
  throw new Error('Unknown action. Use stop or logs.');
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [action, ...extra] = process.argv.slice(2);
  let args;
  try {
    assertProductionVolumeEnvironment();
    args = buildProductionOpsArgs(action, extra);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const result = spawnSync('docker', args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: productionChildEnvironment(),
  });
  if (result.error) {
    console.error(`Docker could not start: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
