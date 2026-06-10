import { createReadStream, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = join(rootDir, 'dist');
const port = Number(process.env.PORT ?? process.env.FRONTEND_PORT ?? 5173);
const apiTarget = new URL(process.env.API_PROXY_TARGET ?? 'http://backend:5000');
const requestClient = apiTarget.protocol === 'https:' ? httpsRequest : httpRequest;

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
    'content-length': Buffer.byteLength(body),
    'content-type': 'text/plain; charset=utf-8',
  });
  response.end(body);
};

const proxyApiRequest = (clientRequest, clientResponse) => {
  const targetUrl = new URL(clientRequest.url ?? '/', apiTarget);
  const proxyRequest = requestClient(
    targetUrl,
    {
      method: clientRequest.method,
      headers: {
        ...clientRequest.headers,
        host: apiTarget.host,
      },
    },
    (proxyResponse) => {
      clientResponse.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(clientResponse);
    },
  );

  proxyRequest.on('error', () => {
    if (!clientResponse.headersSent) {
      sendText(clientResponse, 502, 'Backend API is unavailable.');
    } else {
      clientResponse.end();
    }
  });

  clientRequest.pipe(proxyRequest);
};

const getStaticPath = (requestUrl) => {
  const url = new URL(requestUrl ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const normalizedPath = normalize(pathname).replace(/^([/\\])+/, '');
  const candidatePath = resolve(distDir, normalizedPath);

  if (!candidatePath.startsWith(distDir)) {
    return join(distDir, 'index.html');
  }

  try {
    const stats = statSync(candidatePath);
    if (stats.isFile()) return candidatePath;
  } catch {
    // Fall through to SPA fallback.
  }

  return join(distDir, 'index.html');
};

createServer(async (request, response) => {
  if ((request.url ?? '').startsWith('/api')) {
    proxyApiRequest(request, response);
    return;
  }

  const filePath = getStaticPath(request.url);

  try {
    const stats = statSync(filePath);
    response.writeHead(200, {
      'content-length': stats.size,
      'content-type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    try {
      const indexHtml = await readFile(join(distDir, 'index.html'));
      response.writeHead(200, {
        'content-length': indexHtml.byteLength,
        'content-type': 'text/html; charset=utf-8',
      });
      response.end(indexHtml);
    } catch {
      sendText(response, 500, 'Frontend build is unavailable.');
    }
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Frontend started on http://0.0.0.0:${port}`);
  console.log(`Proxying /api to ${apiTarget.origin}`);
});
