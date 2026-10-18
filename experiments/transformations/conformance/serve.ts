// POC / EXPERIMENT / NOT FOR PRODUCTION
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

import { buildStrictCspPolicy } from '../../security/strict-csp/cspPolicy.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const outputRoot = resolve(repositoryRoot, 'artifacts/experiments/transformation-conformance/root');
const grafanaTarget = new URL(process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000');
const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

await build({ configFile: resolve(experimentRoot, 'vite.provider.config.ts') });
await build({ configFile: resolve(experimentRoot, 'vite.host.config.ts') });

function proxyGrafana(request: IncomingMessage, response: ServerResponse) {
  const upstream = httpRequest({
    headers: request.headers,
    hostname: grafanaTarget.hostname,
    method: request.method,
    path: request.url,
    port: grafanaTarget.port || 80,
    protocol: grafanaTarget.protocol,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Grafana proxy request failed.');
  });
  request.pipe(upstream);
}

function safeFile(pathname: string) {
  const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const candidate = resolve(outputRoot, requested);
  return candidate === outputRoot || candidate.startsWith(`${outputRoot}${sep}`) ? candidate : undefined;
}

async function serveStatic(request: IncomingMessage, response: ServerResponse) {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file = safeFile(pathname);
  if (!file) {
    response.writeHead(403);
    response.end('Forbidden.');
    return;
  }
  const nonce = randomBytes(18).toString('base64url');
  try {
    const metadata = await stat(file);
    if (!metadata.isFile()) throw new Error('Not a file.');
    const headers = {
      'cache-control': extname(file) === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      'content-security-policy': buildStrictCspPolicy(nonce),
      'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
    };
    if (extname(file) === '.html') {
      const body = (await readFile(file, 'utf8')).replace('<head>', `<head>\n    <meta name="grsdk-csp-nonce" content="${nonce}" />`);
      response.writeHead(200, headers);
      response.end(body);
      return;
    }
    response.writeHead(200, headers);
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found.');
  }
}

const server = createServer((request, response) => {
  if ((request.url ?? '').startsWith('/grafana/')) {
    proxyGrafana(request, response);
    return;
  }
  void serveStatic(request, response);
});
server.listen(5198, '0.0.0.0');
const shutdown = () => server.close();
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
await new Promise(() => undefined);
