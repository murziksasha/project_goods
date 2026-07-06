import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const resolveGitSha = () => {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
};

const gitSha = resolveGitSha();
console.log(`Building with GIT_SHA=${gitSha}`);

execSync('docker compose up -d --build', {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    GIT_SHA: gitSha,
  },
});