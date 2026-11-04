import { statSync } from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

const FORWARDED_HEADERS = [
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-port',
  'x-forwarded-prefix',
  'x-forwarded-proto',
  'x-forwarded-server',
  'x-real-ip',
];

export const getProxyHeaders = (clientRequest, apiTarget) => {
  const headers = { ...clientRequest.headers };
  for (const name of FORWARDED_HEADERS) {
    delete headers[name];
  }

  headers.host = apiTarget.host;
  const peerAddress = clientRequest.socket?.remoteAddress;
  if (peerAddress) {
    headers['x-forwarded-for'] = peerAddress;
  }

  return headers;
};

export const isStaticPathContained = (distDir, candidatePath) => {
  const relativePath = relative(distDir, candidatePath);
  return relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath);
};

export const getStaticPath = (requestUrl, distDir) => {
  const fallback = join(distDir, 'index.html');
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://localhost').pathname);
  } catch {
    return fallback;
  }

  const normalizedPath = normalize(pathname).replace(/^([/\\])+/, '');
  const candidatePath = resolve(distDir, normalizedPath);
  if (!isStaticPathContained(distDir, candidatePath)) {
    return fallback;
  }

  try {
    if (statSync(candidatePath).isFile()) return candidatePath;
  } catch {
    // Fall through to SPA fallback.
  }

  return fallback;
};
