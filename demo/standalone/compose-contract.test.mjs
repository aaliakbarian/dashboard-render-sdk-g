#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer, request } from 'node:http';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

// Run in a Node container with Docker CLI/socket access and this checkout mounted
// at its original absolute path. Tests inspect rendered configuration and send
// real requests through Nginx; they never start the application or store tokens.
const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, '../..');
const realmName = 'dashboard-render-sdk-g-demo';
const issuer = `http://localhost:8088/keycloak/realms/${realmName}`;
const grafanaImage = 'grafana/grafana:13.2.3@sha256:d84563330dc9d2fd2bc096d0fb96021b5319c75bf6ed555566709998e823dec4';

function docker(...args) {
  const result = spawnSync('docker', args, { cwd: repository, encoding: 'utf8' });
  assert.equal(result.status, 0, `docker ${args.slice(0, 3).join(' ')} failed: ${result.stderr || result.error}`);
  return result.stdout.trim();
}

function render(...files) {
  return JSON.parse(docker('compose', '--env-file', 'dev/grafana/.env.example',
    ...files.flatMap(file => ['-f', file]), 'config', '--format', 'json'));
}

function validateOAuth(environment) {
  const required = {
    GF_AUTH_ANONYMOUS_ENABLED: 'false',
    GF_AUTH_GENERIC_OAUTH_ENABLED: 'true',
    GF_AUTH_GENERIC_OAUTH_USE_PKCE: 'true',
    GF_AUTH_GENERIC_OAUTH_USE_REFRESH_TOKEN: 'true',
    GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH: "'Viewer'",
    GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_STRICT: 'true',
    GF_AUTH_GENERIC_OAUTH_ALLOW_ASSIGN_GRAFANA_ADMIN: 'false',
    GF_AUTH_GENERIC_OAUTH_SKIP_ORG_ROLE_SYNC: 'false',
    GF_AUTH_GENERIC_OAUTH_CLIENT_ID: 'grafana',
    GF_AUTH_GENERIC_OAUTH_AUTH_URL: `${issuer}/protocol/openid-connect/auth`,
    GF_AUTH_GENERIC_OAUTH_TOKEN_URL: `http://keycloak:8080/keycloak/realms/${realmName}/protocol/openid-connect/token`,
    GF_AUTH_GENERIC_OAUTH_API_URL: `http://keycloak:8080/keycloak/realms/${realmName}/protocol/openid-connect/userinfo`,
    GF_SERVER_ROOT_URL: 'http://localhost:8088/grafana/',
    GF_SERVER_SERVE_FROM_SUB_PATH: 'true',
    GF_AUTH_LOGIN_COOKIE_NAME: 'standalone_demo_grafana_session',
  };
  for (const [name, value] of Object.entries(required)) assert.equal(environment[name], value, name);
  assert.ok(environment.GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET, 'Grafana requires a confidential client secret');
  assert.equal(environment.GF_AUTH_GENERIC_OAUTH_SCOPES, 'openid profile email');
  assert.equal(environment.GF_USERS_AUTO_ASSIGN_ORG_ROLE, 'Viewer');
  assert.equal(environment.GF_AUTH_SIGNOUT_REDIRECT_URL,
    `${issuer}/protocol/openid-connect/logout?client_id=grafana&post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A8088%2F`);
}

test('rendered demo contains four isolated services and the pinned read-only Grafana fixture', () => {
  const config = render('demo/standalone/compose.yaml');
  assert.deepEqual(Object.keys(config.services).sort(), ['grafana', 'host', 'keycloak', 'proxy']);
  for (const [name, service] of Object.entries(config.services)) {
    assert.equal(service.network_mode, undefined, `${name} must remain isolated from host networking`);
    for (const port of service.ports ?? []) {
      assert.equal(name, 'proxy', 'only the browser proxy publishes ports');
      assert.equal(port.host_ip, '127.0.0.1', 'published ports bind loopback only');
      assert.equal(port.published, '8088');
      assert.equal(port.target, 80);
    }
  }
  assert.equal(config.services.proxy.ports.length, 1);
  const grafana = config.services.grafana;
  assert.equal(grafana.image, grafanaImage);
  assert.equal(grafana.platform, 'linux/amd64');
  validateOAuth(grafana.environment);
  const mounts = grafana.volumes.filter(volume => volume.type === 'bind');
  const datasourceMounts = mounts.filter(volume => volume.target.includes('/provisioning/datasources'));
  assert.equal(datasourceMounts.length, 1);
  assert.equal(datasourceMounts[0].source, resolve(repository, 'dev/grafana/provisioning/datasources'));
  assert.deepEqual(readdirSync(datasourceMounts[0].source).filter(name => /\.(?:ya?ml|json)$/.test(name)), ['poc-testdata.yaml']);
  for (const mount of mounts) assert.equal(mount.read_only, true, mount.target);
  assert.ok(mounts.some(mount => mount.source === resolve(repository, 'dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json') &&
    mount.target === '/var/lib/grafana/dashboards/drsdk-g-phase2-visualizations.json'));
  const datasource = readFileSync(resolve(datasourceMounts[0].source, 'poc-testdata.yaml'), 'utf8');
  assert.equal((datasource.match(/^    type: /gm) ?? []).length, 1, 'one provisioned datasource');
  assert.match(datasource, /^    type: grafana-testdata-datasource$/m);
  const keycloak = config.services.keycloak;
  assert.deepEqual(keycloak.command, ['start-dev', '--import-realm']);
  assert.equal(keycloak.environment.KC_HTTP_RELATIVE_PATH, '/keycloak');
  assert.equal(keycloak.environment.KC_HOSTNAME, 'http://localhost:8088/keycloak');
  assert.ok(keycloak.volumes.some(mount => mount.read_only && mount.target === `/opt/keycloak/data/import/${realmName}-realm.json`));
  const host = config.services.host;
  assert.equal(host.build.dockerfile, 'demo/standalone/host.Dockerfile');
  assert.equal(host.environment.GRAFANA_SOURCE_DIR, '/workspace/.grafana-source/grafana-v13.2.3');
  assert.match(host.command.join(' '), /yarn install --immutable.*yarn build:provider-13.*standalone-demo build.*standalone-demo preview/s);
});

test('imported realm contains one public PKCE SPA client, one confidential Grafana client and one Viewer fixture', () => {
  const realm = JSON.parse(readFileSync(resolve(directory, `keycloak/${realmName}-realm.json`), 'utf8'));
  assert.equal(realm.realm, realmName);
  assert.equal(realm.enabled, true);
  assert.equal(realm.registrationAllowed, false);
  assert.equal(realm.users.length, 1);
  const [viewer] = realm.users;
  assert.equal(viewer.username, 'demo-viewer');
  assert.equal(viewer.enabled, true);
  assert.equal(viewer.emailVerified, true);
  assert.equal(viewer.credentials.length, 1);
  assert.equal(viewer.credentials[0].temporary, false);
  assert.match(viewer.credentials[0].value, /development-only/);
  assert.deepEqual(realm.clients.map(client => client.clientId).sort(), ['grafana', 'standalone-demo']);
  const spa = realm.clients.find(client => client.clientId === 'standalone-demo');
  const grafana = realm.clients.find(client => client.clientId === 'grafana');
  for (const client of realm.clients) {
    assert.equal(client.standardFlowEnabled, true);
    assert.equal(client.implicitFlowEnabled, false);
    assert.equal(client.directAccessGrantsEnabled, false);
    assert.equal(client.serviceAccountsEnabled, false);
    assert.equal(client.attributes['pkce.code.challenge.method'], 'S256');
  }
  assert.equal(spa.publicClient, true);
  assert.equal(spa.secret, undefined);
  assert.deepEqual(spa.redirectUris, ['http://localhost:8088/*']);
  assert.deepEqual(spa.webOrigins, ['http://localhost:8088']);
  assert.equal(grafana.publicClient, false);
  assert.equal(grafana.attributes['post.logout.redirect.uris'], 'http://localhost:8088/');
  assert.deepEqual(grafana.redirectUris, ['http://localhost:8088/grafana/login/generic_oauth']);
  assert.equal(grafana.secret, render('demo/standalone/compose.yaml').services.grafana.environment.GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET);
});

test('missing or insecure Grafana OAuth settings are rejected by the contract', () => {
  const environment = render('demo/standalone/compose.yaml').services.grafana.environment;
  validateOAuth(environment);
  for (const key of [
    'GF_AUTH_GENERIC_OAUTH_USE_PKCE', 'GF_AUTH_GENERIC_OAUTH_USE_REFRESH_TOKEN',
    'GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_STRICT', 'GF_AUTH_GENERIC_OAUTH_ALLOW_ASSIGN_GRAFANA_ADMIN',
    'GF_AUTH_GENERIC_OAUTH_SKIP_ORG_ROLE_SYNC', 'GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET',
  ]) {
    const insecure = { ...environment };
    delete insecure[key];
    assert.throws(() => validateOAuth(insecure), { name: 'AssertionError' }, key);
  }
  assert.throws(() => validateOAuth({ ...environment, GF_AUTH_ANONYMOUS_ENABLED: 'true' }), /GF_AUTH_ANONYMOUS_ENABLED/);
});

test('Playwright override changes the existing development runner to host networking without a fifth demo service', () => {
  const config = render('compose.yaml', 'demo/standalone/playwright.compose.yaml');
  assert.deepEqual(Object.keys(config.services).sort(), ['dev', 'grafana']);
  assert.equal(config.services.dev.network_mode, 'host');
  assert.equal(config.services.dev.networks, undefined);
  assert.equal(config.services.dev.ports, undefined);
  assert.equal(config.services.dev.image, 'dashboard-render-sdk-g-poc-dev:local');
});

// Backend doubles expose only routing ownership/path. The real production Nginx
// reads its actual config and chooses which backend (or sentinel) answers.
const servers = [];
let testContainerIp;
let nginxImage;
before(async () => {
  const config = render('demo/standalone/compose.yaml');
  nginxImage = config.services.proxy.image;
  const info = JSON.parse(docker('inspect', process.env.HOSTNAME));
  testContainerIp = Object.values(info[0].NetworkSettings.Networks)[0].IPAddress;
  assert.ok(testContainerIp, 'contract runner must use a Docker bridge network');
  for (const [owner, port] of [['host', 5173], ['grafana', 3000], ['keycloak', 8080]]) {
    const server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ owner, path: request.url, forwardedHost: request.headers['x-forwarded-host'],
        forwardedProto: request.headers['x-forwarded-proto'], authorization: request.headers.authorization }));
    });
    await new Promise(done => server.listen(port, '0.0.0.0', done));
    servers.push(server);
  }
});
after(async () => { await Promise.all(servers.map(server => new Promise(done => server.close(done)))); });

async function withNginx(configuration, check) {
  const temporary = mkdtempSync(resolve(tmpdir(), 'standalone-proxy-contract-'));
  const filename = resolve(temporary, 'nginx.conf');
  writeFileSync(filename, configuration);
  let container;
  try {
    container = docker('create', '--add-host', `host:${testContainerIp}`, '--add-host', `grafana:${testContainerIp}`,
      '--add-host', `keycloak:${testContainerIp}`, nginxImage);
    docker('cp', filename, `${container}:/etc/nginx/nginx.conf`);
    docker('start', container);
    docker('exec', container, 'nginx', '-t');
    const info = JSON.parse(docker('inspect', container));
    const address = `http://${Object.values(info[0].NetworkSettings.Networks)[0].IPAddress}`;
    for (let attempt = 0; ; attempt++) {
      try { await fetch(address); break; }
      catch (error) { if (attempt === 30) throw error; await new Promise(done => setTimeout(done, 100)); }
    }
    await check(address);
  } finally {
    if (container) docker('rm', '--force', container);
    rmSync(temporary, { recursive: true, force: true });
  }
}

async function assertRoute(address, path, owner) {
  // node:http preserves the explicit browser Host header; fetch controls Host.
  const response = await new Promise((accept, reject) => {
    const probe = request(`${address}${path}`, { headers: { host: 'localhost:8088' } }, incoming => {
      let body = '';
      incoming.setEncoding('utf8');
      incoming.on('data', chunk => { body += chunk; });
      incoming.on('end', () => accept({ status: incoming.statusCode, body }));
    });
    probe.on('error', reject);
    probe.end();
  });
  assert.equal(response.status, 200, `${path} must reach ${owner}`);
  const body = JSON.parse(response.body);
  assert.equal(body.owner, owner, path);
  assert.equal(body.path, path, 'proxy preserves the complete subpath');
  assert.equal(body.forwardedHost, 'localhost:8088');
  assert.equal(body.forwardedProto, 'http');
  assert.equal(body.authorization, undefined);
}

async function assertRoutes(address) {
  for (const [path, owner] of [
    ['/', 'host'], ['/src/main.tsx', 'host'], ['/keycloak/realms/demo/protocol/openid-connect/auth', 'keycloak'],
    ['/grafana/api/user', 'grafana'], ['/grafana/login/generic_oauth?code=route-probe', 'grafana'],
    ['/grafana/demo-return/child', 'grafana'], ['/grafana/demo-return-extra', 'grafana'],
  ]) await assertRoute(address, path, owner);
  const sentinel = await fetch(`${address}/grafana/demo-return?orgId=1`, { redirect: 'manual' });
  assert.equal(sentinel.status, 302);
  assert.equal(sentinel.headers.get('location'), '/', 'relative sentinel redirect preserves the published browser port');
  assert.equal(new URL(sentinel.headers.get('location'), address).pathname, '/');
  assert.equal(new URL(sentinel.headers.get('location'), address).search, '');
}

test('real Nginx preserves backend subpaths and intercepts only the exact demo-return sentinel', async () => {
  await withNginx(readFileSync(resolve(directory, 'proxy/nginx.conf'), 'utf8'), assertRoutes);
});

test('real Nginx negative fixture detects a broadened sentinel prefix', async () => {
  const actual = readFileSync(resolve(directory, 'proxy/nginx.conf'), 'utf8');
  const broad = actual.replace('location = /grafana/demo-return', 'location /grafana/demo-return');
  assert.notEqual(broad, actual, 'fixture must broaden the real sentinel location');
  await withNginx(broad, async address => {
    await assert.rejects(() => assertRoutes(address), /must reach grafana/);
  });
});

test('real Nginx negative fixture detects interception of Grafana OAuth callbacks', async () => {
  const actual = readFileSync(resolve(directory, 'proxy/nginx.conf'), 'utf8');
  const broad = actual.replace('location = /grafana/demo-return', 'location ~ ^/grafana/');
  assert.notEqual(broad, actual, 'fixture must redirect the Grafana callback through the sentinel');
  await withNginx(broad, async address => {
    await assert.rejects(() => assertRoute(address, '/grafana/login/generic_oauth?code=route-probe', 'grafana'), /must reach grafana/);
  });
});
