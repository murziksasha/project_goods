import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  assertProductionEnvironment,
  productionChildEnvironment,
  productionComposeArgs,
  projectRoot,
} from './production-env.mjs';
import { assertProductionDockerState } from './production-docker-state.mjs';

try {
  assertProductionDockerState(assertProductionEnvironment());
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const script = [
  'key=/run/mongo-keyfile/keyfile',
  'chown mongodb:mongodb /run/mongo-keyfile; chmod 700 /run/mongo-keyfile',
  'if test -e "$key"; then cat >/dev/null; else umask 077; cat > "$key"; chown mongodb:mongodb "$key"; chmod 400 "$key"; fi',
  'test -s "$key"',
  'test "$(stat -c %a:%u:%g /run/mongo-keyfile)" = 700:999:999',
  'test "$(stat -c %a:%u:%g "$key")" = 400:999:999',
  'echo "Mongo keyfile is ready in its Docker volume (directory 0700, file 0400, owner mongodb)."',
].join('; ');

const result = spawnSync(
  'docker',
  [
    ...productionComposeArgs,
    'run',
    '--rm',
    '--no-deps',
    '-T',
    'mongo-keyfile-init',
    '-euc',
    script,
  ],
  {
    cwd: projectRoot,
    env: productionChildEnvironment(),
    input: randomBytes(512).toString('base64'),
    stdio: ['pipe', 'inherit', 'inherit'],
  },
);

if (result.error) {
  console.error(`Docker could not start: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
