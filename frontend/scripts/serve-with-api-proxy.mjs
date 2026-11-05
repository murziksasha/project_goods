import { createReadStream, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProxyHeaders, getStaticPath } from './proxy-security.mjs';
import { createSecurityHeaders, getCacheControl, noCacheControl } from './security-headers.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json'],
  ['.woff2', 'font/woff2'],
]);

const sendText = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'cache-control': noCacheControl,
    'content-length': Buffer.byteLength(body),
    'content-type': 'text/plain; charset=utf-8',
  });
  response.end(body);
};

const createApiProxy = (apiTarget) => {
  const requestClient = apiTarget.protocol === 'https:' ? httpsRequest : httpRequest;
  return (clientRequest, clientResponse) => {
    const isEventStream = (clientRequest.url ?? '').includes('/events/stream');
    const targetUrl = new URL(clientRequest.url ?? '/', apiTarget);
    const proxyRequest = requestClient(
      targetUrl,
      {
        method: clientRequest.method,
        timeout: isEventStream ? 0 : undefined,
        headers: getProxyHeaders(clientRequest, apiTarget),
      },
      (proxyResponse) => {
        clientResponse.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
        proxyResponse.pipe(clientResponse);
      },
    );

    if (isEventStream) {
      proxyRequest.setTimeout(0);
      clientRequest.setTimeout?.(0);
      clientRequest.socket?.setTimeout?.(0);
    }

    proxyRequest.on('error', () => {
      if (!clientResponse.headersSent) {
        sendText(clientResponse, 502, 'Backend API is unavailable.');
      } else {
        clientResponse.end();
      }
    });

    clientRequest.pipe(proxyRequest);
  };
};

// Production static server + /api proxy. Exported for header tests.
export const createFrontendServer = ({
  distDir = join(rootDir, 'dist'),
  apiTarget = new URL(process.env.API_PROXY_TARGET ?? 'http://backend:5000'),
  applySecurityHeaders = createSecurityHeaders(),
} = {}) => {
  const proxyApiRequest = createApiProxy(apiTarget);
  const server = createServer(async (request, response) => {
    try {
      // Helmet headers on every response: HTML, assets, SPA fallback and errors.
      // For /api the backend headers passed to writeHead override same-named ones.
      await applySecurityHeaders(request, response);
    } catch {
      sendText(response, 500, 'Security headers failed.');
      return;
    }

    if ((request.url ?? '').startsWith('/api')) {
      proxyApiRequest(request, response);
      return;
    }

    const filePath = getStaticPath(request.url, distDir);

    try {
      const stats = statSync(filePath);
      response.writeHead(200, {
        'cache-control': getCacheControl(filePath, distDir),
        'content-length': stats.size,
        'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
      });
      createReadStream(filePath).pipe(response);
    } catch {
      try {
        const indexHtml = await readFile(join(distDir, 'index.html'));
        response.writeHead(200, {
          'cache-control': noCacheControl,
          'content-length': indexHtml.byteLength,
          'content-type': 'text/html; charset=utf-8',
        });
        response.end(indexHtml);
      } catch {
        sendText(response, 500, 'Frontend build is unavailable.');
      }
    }
  });
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  return server;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.PORT ?? process.env.FRONTEND_PORT ?? 5173);
  const apiTarget = new URL(process.env.API_PROXY_TARGET ?? 'http://backend:5000');
  createFrontendServer({ apiTarget }).listen(port, '0.0.0.0', () => {
    console.log(`Frontend started on http://0.0.0.0:${port}`);
    console.log(`Proxying /api to ${apiTarget.origin}`);
  });
}
