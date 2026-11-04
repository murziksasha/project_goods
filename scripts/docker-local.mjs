import { spawnSync } from 'node:child_process';
import { assertLocalDevelopmentHost, projectRoot } from './production-env.mjs';

const option = process.argv[2];
if (!['--mongo', '--down'].includes(option) || process.argv.length !== 3) {
  console.error('Use --mongo to start local MongoDB or --down to stop the local stack.');
  process.exit(1);
}

try {
  assertLocalDevelopmentHost();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const args = option === '--mongo' ? ['compose', 'up', '-d', 'mongo'] : ['compose', 'down'];
const result = spawnSync('docker', args, { cwd: projectRoot, stdio: 'inherit' });
if (result.error) {
  console.error(`Docker could not start: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
