import assert from 'node:assert/strict';

const user = process.env.POC_GRAFANA_VERIFY_USER;
const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;

assert(user, 'POC_GRAFANA_VERIFY_USER is required');
assert(password, 'POC_GRAFANA_VERIFY_PASSWORD is required');

const directBase = 'http://grafana:3000/grafana';
const proxyBase = 'http://dev:5173/grafana';
const basicAuthorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;

async function requestJson(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      authorization: basicAuthorization,
      ...options.headers,
    },
  });
  const body = await response.text();
  assert.equal(response.status, 200, `${base}${path} returned ${response.status}: ${body.slice(0, 160)}`);
  return JSON.parse(body);
}

async function waitForProxy() {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await requestJson(proxyBase, '/api/health');
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw lastError;
}

const directHealth = await requestJson(directBase, '/api/health');
assert.deepEqual(
  { database: directHealth.database, version: directHealth.version },
  { database: 'ok', version: '13.2.3' }
);
assert.equal(typeof directHealth.commit, 'string');

const proxyHealth = await waitForProxy();
assert.deepEqual(proxyHealth, directHealth, 'the /grafana proxy must preserve the health response');

const loginResponse = await fetch(`${proxyBase}/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ user, password }),
});
assert.equal(loginResponse.status, 200, `proxy login returned ${loginResponse.status}`);
const sessionCookie = loginResponse.headers.get('set-cookie');
assert(sessionCookie?.includes('grafana_session='), 'proxy login must preserve Grafana session cookies');
assert(sessionCookie.toLowerCase().includes('path=/grafana'), 'the fixture cookie must be scoped to /grafana');

const discovery = await requestJson(proxyBase, '/apis/dashboard.grafana.app/');
assert.equal(discovery.kind, 'APIGroup');
assert.equal(discovery.name, 'dashboard.grafana.app');
assert(discovery.versions.some((version) => version.version === 'v1'), 'dashboard API discovery must advertise v1');

const datasource = await requestJson(proxyBase, '/api/datasources/uid/grsdk-testdata');
assert.deepEqual(
  {
    isDefault: datasource.isDefault,
    name: datasource.name,
    readOnly: datasource.readOnly,
    type: datasource.type,
    uid: datasource.uid,
  },
  {
    isDefault: true,
    name: 'Dashboard Render SDK G POC TestData',
    readOnly: true,
    type: 'grafana-testdata-datasource',
    uid: 'grsdk-testdata',
  }
);

async function dashboardDto(uid) {
  return requestJson(
    proxyBase,
    `/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/${uid}/dto`
  );
}

const primary = await dashboardDto('grsdk-phase0-poc');
assert.equal(primary.apiVersion, 'dashboard.grafana.app/v1');
assert.equal(primary.kind, 'DashboardWithAccessInfo');
assert.equal(primary.metadata.name, 'grsdk-phase0-poc');
assert.equal('uid' in primary.spec, false, 'V1 DTO identity belongs to metadata.name, not spec.uid');
assert.equal(primary.spec.schemaVersion, 42);
assert.deepEqual(
  primary.spec.panels.map(({ id, type }) => ({ id, type })).sort((left, right) => left.id - right.id),
  [
    { id: 1, type: 'text' },
    { id: 2, type: 'stat' },
    { id: 3, type: 'timeseries' },
    { id: 4, type: 'table' },
  ]
);
for (const panel of primary.spec.panels.filter((candidate) => candidate.targets?.length)) {
  for (const target of panel.targets) {
    assert.deepEqual(target.datasource, {
      type: 'grafana-testdata-datasource',
      uid: 'grsdk-testdata',
    });
  }
}

const alternate = await dashboardDto('grsdk-phase0-poc-alt');
assert.equal(alternate.metadata.name, 'grsdk-phase0-poc-alt');
assert.equal(alternate.spec.schemaVersion, 42);
assert.deepEqual(alternate.spec.panels.map(({ id, type }) => ({ id, type })), [{ id: 1, type: 'text' }]);

const now = Date.now();
const queryResponse = await requestJson(proxyBase, '/api/ds/query', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    from: String(now - 60_000),
    to: String(now),
    queries: [
      {
        datasource: { type: 'grafana-testdata-datasource', uid: 'grsdk-testdata' },
        intervalMs: 1_000,
        maxDataPoints: 60,
        pulseWave: { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 },
        refId: 'A',
        scenarioId: 'predictable_pulse',
      },
    ],
  }),
});
assert.equal(queryResponse.results.A.error, undefined);
assert(queryResponse.results.A.frames.length > 0, 'predictable_pulse must return a data frame');

console.log(
  `Grafana health: version=${directHealth.version} buildCommit=${directHealth.commit} database=${directHealth.database} (BuildCommit identifies the release binary, not the public tag commit)`
);
console.log('Browser path: /grafana proxy reachable; Grafana session cookie preserved with Path=/grafana');
console.log(`Dashboard discovery: ${discovery.versions.map(({ version }) => version).join(', ')}`);
console.log(`Datasource: ${datasource.uid} (${datasource.type}), name=${datasource.name}`);
console.log('Primary dashboard: uid=grsdk-phase0-poc schemaVersion=42 panels=text,stat,timeseries,table');
console.log('Alternate dashboard: uid=grsdk-phase0-poc-alt schemaVersion=42 panels=text');
console.log('Datasource query: predictable_pulse returned at least one frame through /grafana/api/ds/query');
