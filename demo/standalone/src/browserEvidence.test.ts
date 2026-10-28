import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Page } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { dashboardPath, missingPath, observeBrowser, origin } from '../e2e/support';

const realm = '/keycloak/realms/dashboard-render-sdk-g-demo/protocol/openid-connect';
const queryPath = '/grafana/api/ds/query';
const approvedQuery = '?ds_type=grafana-testdata-datasource';
const queryBody = JSON.stringify({ queries: [{ datasource: { uid: 'grsdk-testdata' }, scenarioId: 'predictable_pulse' }] });

// Only browser event delivery is replaced; request inspection and verify() are real.
async function observer() {
  const page = Object.assign(new EventEmitter(), { addInitScript: async () => {} });
  const evidence = await observeBrowser(page as unknown as Page);
  function request(path: string, method = 'GET', headers: Record<string, string> = {}, body: string | null = null) {
    page.emit('request', {
      url: () => `${origin}${path}`, method: () => method,
      headers: () => Object.fromEntries(Object.entries(headers).filter(([name]) => name !== 'cookie')),
      allHeaders: async () => headers,
      postData: () => body, postDataJSON: () => JSON.parse(body ?? 'null'), isNavigationRequest: () => false,
    });
  }
  const verifier = 'fixture-verifier';
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  for (const client of ['standalone-demo', 'grafana']) {
    request(`${realm}/auth?client_id=${client}&response_type=code&code_challenge_method=S256&code_challenge=${challenge}`);
  }
  request(`${realm}/token`, 'POST', {}, `grant_type=authorization_code&client_id=standalone-demo&code_verifier=${verifier}`);
  page.emit('console', { type: () => 'error', location: () => ({ url: `${origin}/grafana/api/user` }), text: () => '401' });
  let completeTokens!: (value: Record<string, string>) => void;
  const tokenBody = new Promise<Record<string, string>>(resolve => { completeTokens = resolve; });
  page.emit('response', { url: () => `${origin}${realm}/token`, status: () => 200, ok: () => true, json: () => tokenBody });
  return { evidence, request, completeTokens };
}

const tokenBody = { access_token: 'opaque-access-fixture', id_token: 'opaque-identity-fixture', refresh_token: 'opaque-refresh-fixture' };

describe('standalone browser request evidence', () => {
  it.each([
    ['header', 'access_token'], ['query', 'id_token'], ['body', 'refresh_token'], ['cookie', 'access_token'],
    ['panel header', 'access_token'], ['path', 'id_token'],
  ] as const)('detects %s forwarding before token response collection completes', async (surface, tokenKind) => {
    const { evidence, request, completeTokens } = await observer();
    const token = tokenBody[tokenKind];
    if (surface === 'header') request('/grafana/api/health', 'GET', { 'x-fixture': token, cookie: 'private-cookie-fixture' });
    if (surface === 'cookie') request('/grafana/api/health', 'GET', { cookie: `fixture=${token}` });
    if (surface === 'panel header') request(`${queryPath}${approvedQuery}`, 'POST', { 'x-panel-id': token }, queryBody);
    if (surface === 'path') request(`/grafana/api/${token}`);
    if (surface === 'query') request(`/grafana/api/health?fixture=${token}`);
    if (surface === 'body') request(`${queryPath}${approvedQuery}`, 'POST', {}, queryBody.replace('predictable_pulse', `predictable_pulse","alias":"${token}`));
    expect(evidence.problems.includes('OIDC credential forwarded to Grafana')).toBe(false);
    const verification = evidence.verify().then(() => '', error => String(error));
    completeTokens(tokenBody);
    const diagnostic = await verification;
    expect(evidence.problems.includes('OIDC credential forwarded to Grafana')).toBe(true);
    expect(diagnostic.length > 0).toBe(true);
    expect([token, 'private-cookie-fixture', queryBody].some(value => diagnostic.includes(value))).toBe(false);
    expect(JSON.stringify(evidence).includes(token)).toBe(false);
  });

  it.each(['count', 'single request size', 'total size'] as const)('fails closed at the request evidence %s bound', async bound => {
    const { evidence, request, completeTokens } = await observer();
    const count = bound === 'count' ? 257 : bound === 'total size' ? 71 : 1;
    const body = 'private-body-fixture'.repeat(bound === 'single request size' ? 4000 : bound === 'total size' ? 3000 : 1);
    for (let i = 0; i < count; i++) request('/grafana/api/health', 'GET', {}, body);
    completeTokens(tokenBody);
    const diagnostic = await evidence.verify().then(() => '', error => String(error));
    expect(evidence.problems).toEqual(['Grafana request evidence limit exceeded']);
    expect(diagnostic.includes('Grafana request evidence limit exceeded')).toBe(true);
    expect(diagnostic.includes('private-body-fixture')).toBe(false);
    expect(JSON.stringify(evidence).includes('private-body-fixture')).toBe(false);
  });

  it.each([
    ['duplicate datasource', `${approvedQuery}&ds_type=grafana-testdata-datasource`],
    ['extra key', `${approvedQuery}&expression=true`],
    ['duplicate request ID', `${approvedQuery}&requestId=one&requestId=two`],
    ['missing datasource', '?requestId=one'],
    ['invalid datasource', '?ds_type=prometheus'],
    ['empty request ID', `${approvedQuery}&requestId=`],
    ['invalid request ID', `${approvedQuery}&requestId=bad%20id`],
    ['oversized request ID', `${approvedQuery}&requestId=${'a'.repeat(129)}`],
    ['empty query', ''],
  ])('rejects %s without exposing query values', async (_name, search) => {
    const { evidence, request } = await observer();
    request(`${queryPath}${search}`, 'POST', {}, queryBody);
    expect(evidence.problems).toEqual(['unexpected API query parameters']);
  });

  it.each(['/grafana/api/user', '/grafana/api/health', '/grafana/apis/dashboard.grafana.app/',
    '/grafana/api/frontend/settings', dashboardPath, missingPath,
  ])('rejects query parameters on approved GET %#', async path => {
    const { evidence, request } = await observer();
    request(`${path}?fixture=private-query-fixture`);
    expect(evidence.problems).toEqual(['unexpected API query parameters']);
  });

  it('accepts approved GETs and optional valid query request IDs', async () => {
    const { evidence, request, completeTokens } = await observer();
    for (const path of ['/grafana/api/user', '/grafana/api/health', '/grafana/apis/dashboard.grafana.app/',
      '/grafana/api/frontend/settings', dashboardPath, missingPath]) request(path);
    for (const search of [approvedQuery, `${approvedQuery}&requestId=drsdk-1_A`,
      `?requestId=${'a'.repeat(128)}&ds_type=grafana-testdata-datasource`]) request(`${queryPath}${search}`, 'POST', {}, queryBody);
    completeTokens(tokenBody);
    await evidence.verify();
    expect(evidence.problems).toEqual([]);
  });
});
