// POC / EXPERIMENT / NOT FOR PRODUCTION
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

import { buildStrictCspPolicy } from './cspPolicy.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const providerConfig = resolve(experimentRoot, 'vite.provider.config.ts');
const hostConfig = resolve(experimentRoot, 'vite.host.config.ts');
const grafanaTarget = new URL(process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000');

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

await build({ configFile: providerConfig });
for (const profile of ['root', 'nested'] as const) {
  process.env.STRICT_CSP_PROFILE = profile;
  await build({ configFile: hostConfig });
}

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

function responseNonce() {
  return randomBytes(18).toString('base64url');
}

function injectNonce(html: string, nonce: string) {
  return html.replace('<head>', `<head>\n    <meta name="grsdk-csp-nonce" content="${nonce}" />`);
}

function safeFile(root: string, pathname: string, prefix: string) {
  const relative = prefix === '/' ? pathname.slice(1) : pathname.slice(prefix.length);
  const requested = relative === '' ? 'index.html' : decodeURIComponent(relative);
  const candidate = resolve(root, requested);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return undefined;
  return candidate;
}

async function serveStatic(
  request: IncomingMessage,
  response: ServerResponse,
  root: string,
  prefix: string,
) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const file = safeFile(root, url.pathname, prefix);
  if (!file) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Forbidden.');
    return;
  }
  try {
    const metadata = await stat(file);
    if (!metadata.isFile()) throw new Error('Not a file.');
    const nonce = responseNonce();
    const policy = buildStrictCspPolicy(nonce);
    const headers: Record<string, string> = {
      'cache-control': 'no-store',
      'content-security-policy': policy,
      'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream',
      'cross-origin-opener-policy': 'same-origin',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    };
    if (extname(file) === '.html') {
      const body = injectNonce(await readFile(file, 'utf8'), nonce);
      headers.etag = `"${createHash('sha256').update(body).digest('hex')}"`;
      response.writeHead(200, headers);
      response.end(body);
      return;
    }
    response.writeHead(200, headers);
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, {
      'content-security-policy': buildStrictCspPolicy(responseNonce()),
      'content-type': 'text/plain; charset=utf-8',
      'x-content-type-options': 'nosniff',
    });
    response.end('Not found.');
  }
}

function startProfile(profile: 'nested' | 'root', port: number) {
  const prefix = profile === 'nested' ? '/app/sdk/' : '/';
  const root = resolve(repositoryRoot, `artifacts/experiments/strict-csp/${profile}`);
  const server = createServer((request, response) => {
    if ((request.url ?? '').startsWith('/grafana/')) {
      proxyGrafana(request, response);
      return;
    }
    void serveStatic(request, response, root, prefix);
  });
  return new Promise<ReturnType<typeof createServer>>((resolveStarted) => {
    server.listen(port, '0.0.0.0', () => resolveStarted(server));
  });
}

const servers = await Promise.all([startProfile('root', 5192), startProfile('nested', 5193)]);
const shutdown = () => servers.forEach((server) => server.close());
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

await new Promise(() => undefined);
