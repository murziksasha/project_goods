import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getProxyHeaders, getStaticPath, isStaticPathContained } from './proxy-security.mjs';

test('API proxy replaces client-supplied forwarding headers with the socket peer', () => {
  const headers = getProxyHeaders(
    {
      headers: {
        authorization: 'Bearer example',
        forwarded: 'for=203.0.113.1',
        'x-forwarded-for': '203.0.113.1, 198.51.100.2',
        'x-forwarded-host': 'evil.example',
        'x-forwarded-port': '443',
        'x-forwarded-prefix': '/admin',
        'x-forwarded-proto': 'https',
        'x-forwarded-server': 'evil.example',
        'x-real-ip': '203.0.113.1',
      },
      socket: { remoteAddress: '192.168.10.42' },
    },
    new URL('http://backend:5000'),
  );

  assert.equal(headers.host, 'backend:5000');
  assert.equal(headers.authorization, 'Bearer example');
  assert.equal(headers['x-forwarded-for'], '192.168.10.42');
  for (const name of [
    'forwarded',
    'x-forwarded-host',
    'x-forwarded-port',
    'x-forwarded-prefix',
    'x-forwarded-proto',
    'x-forwarded-server',
    'x-real-ip',
  ]) {
    assert.equal(headers[name], undefined);
  }
});

test('API proxy never retains a forged IP when the socket peer is unavailable', () => {
  const headers = getProxyHeaders(
    { headers: { 'x-forwarded-for': '203.0.113.1' }, socket: {} },
    new URL('http://backend:5000'),
  );
  assert.equal(headers['x-forwarded-for'], undefined);
});

test('static server serves in-directory files and falls back for sibling traversal', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'project-goods-proxy-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const distDir = join(root, 'dist');
  const siblingDir = join(root, 'dist-old');
  await mkdir(distDir);
  await mkdir(siblingDir);
  const indexPath = join(distDir, 'index.html');
  const assetPath = join(distDir, 'asset.js');
  await writeFile(indexPath, '<html></html>', 'utf8');
  await writeFile(assetPath, 'export {};', 'utf8');
  await writeFile(join(siblingDir, 'secret.txt'), 'do not serve', 'utf8');

  assert.equal(isStaticPathContained(distDir, assetPath), true);
  assert.equal(isStaticPathContained(distDir, join(siblingDir, 'secret.txt')), false);
  assert.equal(getStaticPath('/asset.js', distDir), assetPath);
  assert.equal(getStaticPath('/%2e%2e%2fdist-old%2fsecret.txt', distDir), indexPath);
  assert.equal(getStaticPath('/%2e%2e%5cdist-old%5csecret.txt', distDir), indexPath);
  assert.equal(getStaticPath('/%broken', distDir), indexPath);
});
