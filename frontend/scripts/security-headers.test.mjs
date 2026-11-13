import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createSecurityHeaders,
  getCacheControl,
  immutableCacheControl,
  noCacheControl,
  parseCspReportOnly,
} from './security-headers.mjs';
import { createFrontendServer } from './serve-with-api-proxy.mjs';

const listen = (server) =>
  new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise(server.address().port));
  });
const close = (server) =>
  new Promise((resolvePromise) => {
    server.close(resolvePromise);
    server.closeAllConnections?.();
  });

const withServer = async ({ reportOnly = true, apiTarget, dist = true }, run) => {
  const root = await mkdtemp(join(tmpdir(), 'frontend-headers-'));
  const distDir = join(root, 'dist');
  if (dist) {
    await mkdir(join(distDir, 'assets'), { recursive: true });
    await writeFile(join(distDir, 'index.html'), '<!doctype html><title>t</title>');
    await writeFile(join(distDir, 'theme-init.js'), '/* theme */');
    await writeFile(join(distDir, 'assets', 'index-abc123.js'), 'console.log(1);');
  }
  const server = createFrontendServer({
    distDir,
    apiTarget: apiTarget ?? new URL('http://127.0.0.1:9'),
    applySecurityHeaders: createSecurityHeaders(reportOnly),
  });
  const port = await listen(server);
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await close(server);
    await rm(root, { recursive: true, force: true });
  }
};

const assertSecurityHeaders = (response, { reportOnly = true } = {}) => {
  const name = reportOnly ? 'content-security-policy-report-only' : 'content-security-policy';
  const other = reportOnly ? 'content-security-policy' : 'content-security-policy-report-only';
  const csp = response.headers.get(name);
  assert.ok(csp, `${name} is set`);
  assert.equal(response.headers.get(other), null);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  assert.equal(response.headers.get('strict-transport-security'), null);
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
};

test('CSP_REPORT_ONLY defaults to report-only and accepts false values', () => {
  assert.equal(parseCspReportOnly(undefined), true);
  assert.equal(parseCspReportOnly(''), true);
  assert.equal(parseCspReportOnly('garbage'), true);
  assert.equal(parseCspReportOnly('true'), true);
  assert.equal(parseCspReportOnly('false'), false);
  assert.equal(parseCspReportOnly(' OFF '), false);
  assert.equal(parseCspReportOnly('0'), false);
});

test('only hashed /assets files are cached as immutable', () => {
  const distDir = join('/app', 'frontend', 'dist');
  assert.equal(getCacheControl(join(distDir, 'assets', 'index-abc.js'), distDir), immutableCacheControl);
  assert.equal(getCacheControl(join(distDir, 'index.html'), distDir), noCacheControl);
  assert.equal(getCacheControl(join(distDir, 'theme-init.js'), distDir), noCacheControl);
  assert.equal(getCacheControl(join(distDir, 'favicon.ico'), distDir), noCacheControl);
  assert.equal(getCacheControl(join(distDir, 'assets-not', 'x.js'), distDir), noCacheControl);
});

test('HTML, theme script, assets and SPA fallback carry security headers', async () => {
  await withServer({}, async (base) => {
    const html = await fetch(`${base}/`);
    assert.equal(html.status, 200);
    assertSecurityHeaders(html);
    assert.equal(html.headers.get('cache-control'), noCacheControl);

    const theme = await fetch(`${base}/theme-init.js`);
    assert.equal(theme.status, 200);
    assertSecurityHeaders(theme);
    assert.equal(theme.headers.get('cache-control'), noCacheControl);

    const asset = await fetch(`${base}/assets/index-abc123.js`);
    assert.equal(asset.status, 200);
    assertSecurityHeaders(asset);
    assert.equal(asset.headers.get('cache-control'), immutableCacheControl);

    const fallback = await fetch(`${base}/orders/123`);
    assert.equal(fallback.status, 200);
    assert.match(fallback.headers.get('content-type'), /text\/html/);
    assertSecurityHeaders(fallback);
    assert.equal(fallback.headers.get('cache-control'), noCacheControl);
  });
});

test('enforcing mode sends Content-Security-Policy', async () => {
  await withServer({ reportOnly: false }, async (base) => {
    assertSecurityHeaders(await fetch(`${base}/`), { reportOnly: false });
  });
});

test('missing build (500) and unavailable backend (502) carry security headers', async () => {
  await withServer({ dist: false }, async (base) => {
    const missing = await fetch(`${base}/`);
    assert.equal(missing.status, 500);
    assertSecurityHeaders(missing);
  });
  const blocker = createServer();
  const closedPort = await listen(blocker);
  await close(blocker);
  await withServer({ apiTarget: new URL(`http://127.0.0.1:${closedPort}`) }, async (base) => {
    const error = await fetch(`${base}/api/health`);
    assert.equal(error.status, 502);
    assertSecurityHeaders(error);
  });
});

test('API responses keep backend headers over proxy defaults', async () => {
  const backend = createServer((_request, response) => {
    response.writeHead(200, {
      'content-type': 'application/json',
      'x-frame-options': 'DENY',
    });
    response.end('{"status":"ok"}');
  });
  const backendPort = await listen(backend);
  try {
    await withServer({ apiTarget: new URL(`http://127.0.0.1:${backendPort}`) }, async (base) => {
      const response = await fetch(`${base}/api/health`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.equal(await response.text(), '{"status":"ok"}');
    });
  } finally {
    await close(backend);
  }
});

test('index.html has no inline scripts and loads the theme script from public/', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length > 0);
  for (const [, attributes, body] of scripts) {
    assert.match(attributes, /\bsrc=/, 'every script has src');
    assert.equal(body.trim(), '', 'no inline script body');
  }
  const themeIndex = html.indexOf('<script src="/theme-init.js"></script>');
  assert.ok(themeIndex > 0 && themeIndex < html.indexOf('</head>'), 'theme script is blocking in <head>');
  const theme = await readFile(new URL('../public/theme-init.js', import.meta.url), 'utf8');
  assert.match(theme, /project-goods\.ui-theme/);
});
