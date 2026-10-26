import type {
  HostTransportCapability,
  HostTransportDescriptor,
  HostTransportExecutor,
  HostTransportResponse,
  TransportRequest,
} from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it, vi } from 'vitest';
import { createHostTransportCapability } from './hostTransport';

const validDescriptor = (): HostTransportDescriptor => ({
  basePath: '/grafana',
  requestPolicyId: 'browser-session-policy-v1',
  schemaVersion: 1,
  securityScopeId: 'organization-1',
  targetOrigin: 'https://example.invalid',
});

const neverCalledExecutor = (): HostTransportExecutor =>
  vi.fn(async () => ({ body: '', headers: [], status: 204 }));

function createCapability(executor: HostTransportExecutor): HostTransportCapability {
  const result = createHostTransportCapability(validDescriptor(), executor);
  if (!result.valid) throw new Error('Expected valid test capability.');
  return result.capability;
}

function validRequest(signal = new AbortController().signal): TransportRequest {
  return {
    method: 'GET',
    path: '/api/health',
    requestId: 'request-1',
    signal,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('createHostTransportCapability descriptor validation', () => {
  it('creates a frozen capability from a detached normalized HTTPS descriptor without invoking the executor', () => {
    const descriptor = {
      ...validDescriptor(),
      basePath: '/grafana/',
      targetOrigin: 'HTTPS://EXAMPLE.COM:443/',
    };
    const executor = neverCalledExecutor();

    const result = createHostTransportCapability(descriptor, executor);

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.capability.descriptor).toEqual({
      ...validDescriptor(),
      targetOrigin: 'https://example.com',
    });
    expect(executor).not.toHaveBeenCalled();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.capability)).toBe(true);
    expect(Object.isFrozen(result.capability.descriptor)).toBe(true);
    expect('executor' in result.capability).toBe(false);
    expect('transportCapabilityId' in result.capability).toBe(false);

    descriptor.basePath = '/mutated';
    expect(result.capability.descriptor.basePath).toBe('/grafana');
  });

  it('accepts HTTP development origins and preserves the root base path', () => {
    const result = createHostTransportCapability(
      { ...validDescriptor(), basePath: '/', targetOrigin: 'http://127.0.0.1:3000/' },
      neverCalledExecutor()
    );

    expect(result).toMatchObject({
      valid: true,
      capability: {
        descriptor: { basePath: '/', targetOrigin: 'http://127.0.0.1:3000' },
      },
    });
  });

  it.each([
    ['invalid schema', { schemaVersion: 2 }],
    ['non-http origin', { targetOrigin: 'ftp://example.invalid' }],
    ['origin credentials', { targetOrigin: 'https://user:pass@example.invalid' }],
    ['origin empty username', { targetOrigin: 'https://@example.invalid' }],
    ['origin empty credentials', { targetOrigin: 'https://:@example.invalid' }],
    ['origin empty hostname port', { targetOrigin: 'https://example.invalid:' }],
    ['origin empty hostname port with slash', { targetOrigin: 'https://example.invalid:/' }],
    ['origin empty IPv6 port', { targetOrigin: 'https://[::1]:' }],
    ['origin empty IPv4 port with slash', { targetOrigin: 'http://127.0.0.1:/' }],
    ['origin path', { targetOrigin: 'https://example.invalid/grafana' }],
    ['origin normalized parent path', { targetOrigin: 'https://example.invalid/private/..' }],
    ['origin normalized current path', { targetOrigin: 'https://example.invalid/./' }],
    ['origin backslash', { targetOrigin: 'https://example.invalid\\' }],
    ['origin normalized backslash parent path', { targetOrigin: 'https://example.invalid\\private\\..' }],
    ['origin normalized backslash current path', { targetOrigin: 'https://example.invalid\\.\\' }],
    ['origin query', { targetOrigin: 'https://example.invalid?x=1' }],
    ['origin empty query', { targetOrigin: 'https://example.invalid?' }],
    ['origin fragment', { targetOrigin: 'https://example.invalid/#x' }],
    ['origin empty fragment', { targetOrigin: 'https://example.invalid#' }],
    ['origin surrounding whitespace', { targetOrigin: ' https://example.invalid ' }],
    ['origin trailing null', { targetOrigin: 'https://example.invalid\u0000' }],
    ['origin trailing unit separator', { targetOrigin: 'https://example.invalid\u001f' }],
    ['relative base path', { basePath: 'grafana' }],
    ['base path traversal', { basePath: '/a/../b' }],
    ['encoded base separator', { basePath: '/a%2fb' }],
    ['double-encoded base traversal', { basePath: '/%252e%252e' }],
    ['base path lone high surrogate', { basePath: '/\ud800' }],
    ['base path lone low surrogate', { basePath: '/\udfff' }],
    ['blank security scope', { securityScopeId: '' }],
    ['control in policy ID', { requestPolicyId: 'policy\nvalue' }],
  ])('rejects %s with fixed non-echoing diagnostics', (_name, replacement) => {
    const input = { ...validDescriptor(), ...replacement } as HostTransportDescriptor;

    const result = createHostTransportCapability(input, neverCalledExecutor());

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    const rejectedValue = String(Object.values(replacement)[0]);
    for (const error of result.errors) {
      expect(Object.isFrozen(error)).toBe(true);
      if (rejectedValue !== '') expect(error.message).not.toContain(rejectedValue);
    }
  });

  it('accepts descriptor values at supported limits and rejects values one over', () => {
    const accepted = createHostTransportCapability(
      {
        ...validDescriptor(),
        basePath: `/${'a'.repeat(8_191)}`,
        requestPolicyId: 'p'.repeat(256),
        securityScopeId: 's'.repeat(256),
      },
      neverCalledExecutor()
    );
    const oversizedOrigin = createHostTransportCapability(
      { ...validDescriptor(), targetOrigin: `https://${'a'.repeat(2_041)}.invalid` },
      neverCalledExecutor()
    );
    const oversizedBase = createHostTransportCapability(
      { ...validDescriptor(), basePath: `/${'a'.repeat(8_192)}` },
      neverCalledExecutor()
    );
    const oversizedId = createHostTransportCapability(
      { ...validDescriptor(), securityScopeId: 's'.repeat(257) },
      neverCalledExecutor()
    );

    expect(accepted.valid).toBe(true);
    expect(oversizedOrigin.valid).toBe(false);
    expect(oversizedBase.valid).toBe(false);
    expect(oversizedId.valid).toBe(false);
  });

  it('rejects unknown, symbol, non-enumerable, accessor, and non-plain descriptor fields without invoking accessors', () => {
    let accessorCalls = 0;
    const inputs: unknown[] = [];
    inputs.push({ ...validDescriptor(), unknown: true });
    inputs.push({ ...validDescriptor(), [Symbol('hidden')]: true });
    const nonEnumerable = validDescriptor() as unknown as Record<string, unknown>;
    Object.defineProperty(nonEnumerable, 'hidden', { enumerable: false, value: true });
    inputs.push(nonEnumerable);
    const accessor = validDescriptor() as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, 'basePath', {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return '/grafana';
      },
    });
    inputs.push(accessor);
    inputs.push(Object.assign(Object.create({ inherited: true }) as object, validDescriptor()));

    for (const input of inputs) {
      const result = createHostTransportCapability(
        input as HostTransportDescriptor,
        neverCalledExecutor()
      );
      expect(result.valid).toBe(false);
    }
    expect(accessorCalls).toBe(0);
  });

  it('bounds deterministic descriptor diagnostics at 100', () => {
    const input = validDescriptor() as unknown as Record<string, unknown>;
    for (let index = 0; index < 105; index += 1) input[`unknown${index}`] = index;

    const first = createHostTransportCapability(
      input as unknown as HostTransportDescriptor,
      neverCalledExecutor()
    );
    const second = createHostTransportCapability(
      input as unknown as HostTransportDescriptor,
      neverCalledExecutor()
    );

    expect(first.valid).toBe(false);
    expect(second.valid).toBe(false);
    if (first.valid || second.valid) return;
    expect(first.errors).toHaveLength(100);
    expect(second.errors).toEqual(first.errors);
  });

  it('uses bounded fixed diagnostics for secret-bearing unknown descriptor keys', () => {
    const secretKey = `SECRET-MARKER-${'x'.repeat(10_000)}`;
    let accessorCalls = 0;
    const accessorInput = validDescriptor() as unknown as Record<string, unknown>;
    Object.defineProperty(accessorInput, secretKey, {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return true;
      },
    });
    const throwingDescriptor = { ...validDescriptor(), [secretKey]: true };
    const throwingInput = new Proxy(throwingDescriptor, {
      getOwnPropertyDescriptor(target, key) {
        if (key === secretKey) throw new Error('SECRET-CAUSE');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });

    for (const input of [accessorInput, throwingInput]) {
      const result = createHostTransportCapability(
        input as unknown as HostTransportDescriptor,
        neverCalledExecutor()
      );

      expect(result.valid).toBe(false);
      if (result.valid) continue;
      expect(result.errors).toContainEqual({
        code: 'invalid-descriptor',
        message: 'Transport descriptor contains an unknown field.',
        path: '$',
      });
      expect(JSON.stringify(result)).not.toContain('SECRET-MARKER');
      expect(JSON.stringify(result)).not.toContain('SECRET-CAUSE');
      expect(JSON.stringify(result).length).toBeLessThan(1_000);
    }
    expect(accessorCalls).toBe(0);
  });

  it('rejects oversized records, throwing and revoked proxies, and non-function executors', () => {
    const oversized = validDescriptor() as unknown as Record<string, unknown>;
    for (let index = 0; index < 1_025; index += 1) oversized[`extra${index}`] = index;
    const throwing = new Proxy(validDescriptor(), {
      ownKeys() {
        throw new Error('must not escape');
      },
    });
    const { proxy, revoke } = Proxy.revocable(validDescriptor(), {});
    revoke();

    const oversizedResult = createHostTransportCapability(
      oversized as unknown as HostTransportDescriptor,
      neverCalledExecutor()
    );
    const throwingResult = createHostTransportCapability(throwing, neverCalledExecutor());
    const revokedResult = createHostTransportCapability(proxy, neverCalledExecutor());
    const executorResult = createHostTransportCapability(
      validDescriptor(),
      'not-a-function' as unknown as HostTransportExecutor
    );

    expect(oversizedResult.valid).toBe(false);
    expect(throwingResult.valid).toBe(false);
    expect(revokedResult.valid).toBe(false);
    expect(executorResult).toMatchObject({
      valid: false,
      errors: [{ code: 'invalid-executor', path: '$.executor' }],
    });
  });
});

describe('HostTransportCapability request normalization', () => {
  it('passes one detached frozen canonical request to the trusted executor', async () => {
    const controller = new AbortController();
    let received: TransportRequest | undefined;
    const executor: HostTransportExecutor = vi.fn(async (request) => {
      received = request;
      return { body: 'ok', headers: [], status: 200 };
    });
    const capability = createCapability(executor);
    const query = [
      ['name', 'first'],
      ['name', 'second'],
    ] as const;
    const headers = [['X-Panel-Title', 'Stat']] as const;

    await capability.execute({
      body: '{"query":true}',
      headers,
      method: 'POST',
      path: '/api/%68ealth/',
      query,
      requestId: 'request-123',
      signal: controller.signal,
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(received).toEqual({
      body: '{"query":true}',
      headers: [['x-panel-title', 'Stat']],
      method: 'POST',
      path: '/api/health/',
      query: [
        ['name', 'first'],
        ['name', 'second'],
      ],
      requestId: 'request-123',
      signal: controller.signal,
    });
    expect(received?.signal).toBe(controller.signal);
    expect(Object.isFrozen(received)).toBe(true);
    expect(Object.isFrozen(received?.headers)).toBe(true);
    expect(Object.isFrozen(received?.headers?.[0])).toBe(true);
    expect(Object.isFrozen(received?.query)).toBe(true);
    expect(Object.isFrozen(received?.query?.[0])).toBe(true);
    expect(received?.headers).not.toBe(headers);
    expect(received?.query).not.toBe(query);
  });

  it('canonicalizes explicit undefined optional fields as omission', async () => {
    let received: TransportRequest | undefined;
    const capability = createCapability(async (request) => {
      received = request;
      return { body: '', headers: [], status: 204 };
    });

    await capability.execute({ ...validRequest(), body: undefined, headers: undefined, query: undefined });

    expect(received).toBeDefined();
    expect(Object.hasOwn(received!, 'body')).toBe(false);
    expect(Object.hasOwn(received!, 'headers')).toBe(false);
    expect(Object.hasOwn(received!, 'query')).toBe(false);
  });

  it.each([
    ['relative path', 'api/health', 'invalid-request'],
    ['absolute URL', 'https://other.invalid/api', 'path-outside-capability'],
    ['protocol-relative URL', '//other.invalid/api', 'path-outside-capability'],
    ['embedded query', '/api/health?x=1', 'invalid-request'],
    ['embedded fragment', '/api/health#x', 'invalid-request'],
    ['raw backslash', '/api\\health', 'path-outside-capability'],
    ['encoded slash', '/api%2fhealth', 'path-outside-capability'],
    ['encoded backslash', '/api%5chealth', 'path-outside-capability'],
    ['malformed percent escape', '/api/%zz', 'invalid-request'],
    ['lone high surrogate', '/api/\ud800', 'invalid-request'],
    ['lone low surrogate', '/api/\udfff', 'invalid-request'],
    ['raw traversal', '/api/../admin', 'path-outside-capability'],
    ['encoded traversal', '/api/%2e%2e/admin', 'path-outside-capability'],
    ['double-encoded traversal', '/api/%252e%252e/admin', 'path-outside-capability'],
    ['control character', '/api/health\n', 'invalid-request'],
    ['empty interior segment', '/api//health', 'invalid-request'],
    ['repeated base prefix', '/grafana/api/health', 'path-outside-capability'],
  ] as const)('rejects %s before executor invocation', async (_name, path, code) => {
    const executor = neverCalledExecutor();
    const result = await createCapability(executor).execute({ ...validRequest(), path });

    expect(result).toEqual({ code, kind: 'policy-error', requestId: 'request-1' });
    expect(executor).not.toHaveBeenCalled();
  });

  it('accepts request, path, query, and header fields at exact bounds', async () => {
    const executor = neverCalledExecutor();
    const capability = createCapability(executor);
    const query = Array.from({ length: 1_024 }, (_, index) => [`q${index}`, 'v'] as const);
    const headers = Array.from({ length: 1_024 }, (_, index) => [
      `x-header-${index}`,
      'v',
    ] as const);

    await capability.execute({
      headers,
      method: 'POST',
      path: `/${'a'.repeat(8_191)}`,
      query,
      requestId: 'r'.repeat(256),
      signal: new AbortController().signal,
    });

    expect(executor).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['request ID', { requestId: 'r'.repeat(257) }],
    ['path', { path: `/${'a'.repeat(8_192)}` }],
    ['query component', { query: [['q'.repeat(8_193), 'v']] }],
    ['query count', { query: Array.from({ length: 1_025 }, () => ['q', 'v']) }],
    ['header count', { headers: Array.from({ length: 1_025 }, (_, i) => [`x-${i}`, 'v']) }],
    ['header name', { headers: [[`x${'a'.repeat(256)}`, 'v']] }],
    ['header value', { headers: [['x-test', 'v'.repeat(8_193)]] }],
  ])('rejects one-over-limit %s input', async (_name, replacement) => {
    const executor = neverCalledExecutor();
    const result = await createCapability(executor).execute({
      ...validRequest(),
      ...replacement,
    } as TransportRequest);

    expect(result).toMatchObject({ kind: 'policy-error', code: 'invalid-request' });
    expect(executor).not.toHaveBeenCalled();
  });

  it('rejects sparse and malformed query arrays plus unknown, symbol, accessor, and proxy request fields', async () => {
    const executor = neverCalledExecutor();
    const capability = createCapability(executor);
    const sparse = new Array(2) as [readonly [string, string], readonly [string, string]];
    sparse[1] = ['q', 'v'];
    const accessor = { ...validRequest() } as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, 'path', { enumerable: true, get: () => '/api/health' });
    const throwing = new Proxy(validRequest(), {
      ownKeys() {
        throw new Error('must not escape');
      },
    });
    const inputs: unknown[] = [
      { ...validRequest(), query: sparse },
      { ...validRequest(), query: [['only-one']] },
      { ...validRequest(), unknown: true },
      { ...validRequest(), [Symbol('hidden')]: true },
      accessor,
      throwing,
    ];

    for (const input of inputs) {
      const result = await capability.execute(input as TransportRequest);
      expect(result).toMatchObject({ code: 'invalid-request', kind: 'policy-error' });
    }
    expect(executor).not.toHaveBeenCalled();
  });

  it.each([
    'Authorization',
    'COOKIE',
    'Proxy-Authorization',
    'X-Api-Key',
    'x-auth-token',
  ])('rejects credential-bearing header %s without echoing its value', async (name) => {
    const executor = neverCalledExecutor();
    const result = await createCapability(executor).execute({
      ...validRequest(),
      headers: [[name, 'must-not-persist']],
    });

    expect(result).toEqual({
      code: 'credential-header-forbidden',
      kind: 'policy-error',
      requestId: 'request-1',
    });
    expect(JSON.stringify(result)).not.toContain('must-not-persist');
    expect(executor).not.toHaveBeenCalled();
  });

  it.each([
    'host',
    'origin',
    'forwarded',
    'x-real-ip',
    'X-Grafana-Org-Id',
    'x-scope-orgid',
    'x-org-id',
    'x-tenant-id',
    'x-user-id',
    'x-forwarded-custom',
  ])('rejects host-controlled header %s while allowing host-owned policy', async (name) => {
    const executor = neverCalledExecutor();
    const result = await createCapability(executor).execute({
      ...validRequest(),
      headers: [[name, 'must-not-persist']],
    });

    expect(result).toEqual({
      code: 'host-controlled-header-forbidden',
      kind: 'policy-error',
      requestId: 'request-1',
    });
    expect(JSON.stringify(result)).not.toContain('must-not-persist');
    expect(executor).not.toHaveBeenCalled();
  });

  it('allows unrelated application x-headers and preserves opaque bodies', async () => {
    const executor = neverCalledExecutor();
    const body = '{"notParsed":"must-not-appear-in-errors"}';
    await createCapability(executor).execute({
      ...validRequest(),
      body,
      headers: [['x-panel-title', 'Stat']],
    });

    expect(executor).toHaveBeenCalledWith(expect.objectContaining({ body }));
  });

  it.each([
    [['bad header', 'value']],
    [['x-test', 'line\nvalue']],
    [['x-test']],
  ])('rejects malformed request headers', async (...headers) => {
    const executor = neverCalledExecutor();
    const result = await createCapability(executor).execute({
      ...validRequest(),
      headers: headers as unknown as readonly (readonly [string, string])[],
    });

    expect(result).toMatchObject({ code: 'invalid-request', kind: 'policy-error' });
    expect(executor).not.toHaveBeenCalled();
  });

  it('requires a same-realm native AbortSignal and fails closed on revoked proxies', async () => {
    const executor = neverCalledExecutor();
    const capability = createCapability(executor);
    const signalShaped = {
      aborted: false,
      addEventListener() {},
      removeEventListener() {},
    } as unknown as AbortSignal;
    const { proxy, revoke } = Proxy.revocable(new AbortController().signal, {});
    revoke();

    const shapedResult = await capability.execute({ ...validRequest(), signal: signalShaped });
    const revokedResult = await capability.execute({
      ...validRequest(),
      signal: proxy as AbortSignal,
    });

    expect(shapedResult).toMatchObject({ code: 'invalid-request', kind: 'policy-error' });
    expect(revokedResult).toMatchObject({ code: 'invalid-request', kind: 'policy-error' });
    expect(executor).not.toHaveBeenCalled();
  });
});

describe('HostTransportCapability response and cancellation normalization', () => {
  it.each([200, 401, 403, 500])('preserves completed HTTP status %s as a response', async (status) => {
    const capability = createCapability(async () => ({
      body: '{"result":true}',
      headers: [['X-Request-Id', 'server-request']],
      status,
    }));

    const result = await capability.execute(validRequest());

    expect(result).toEqual({
      kind: 'response',
      requestId: 'request-1',
      response: {
        body: '{"result":true}',
        headers: [['x-request-id', 'server-request']],
        status,
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'response') {
      expect(Object.isFrozen(result.response)).toBe(true);
      expect(Object.isFrozen(result.response.headers)).toBe(true);
      expect(Object.isFrozen(result.response.headers[0])).toBe(true);
    }
  });

  it('filters only known sensitive response headers without claiming host data is credential-free', async () => {
    const sensitiveNames = [
      'Set-Cookie',
      'set-cookie2',
      'Authorization',
      'proxy-authorization',
      'authentication-info',
      'proxy-authentication-info',
    ];
    const response: HostTransportResponse = {
      body: 'trusted host body may itself contain sensitive application data',
      headers: [
        ...sensitiveNames.map((name) => [name, 'must-not-cross'] as const),
        ['Content-Type', 'application/json'],
      ],
      status: 200,
    };

    const result = await createCapability(async () => response).execute(validRequest());

    expect(result).toEqual({
      kind: 'response',
      requestId: 'request-1',
      response: {
        body: response.body,
        headers: [['content-type', 'application/json']],
        status: 200,
      },
    });
  });

  it('accepts exactly 1,024 dense response headers and rejects 1,025', async () => {
    const acceptedHeaders = Array.from({ length: 1_024 }, (_, index) => [
      `x-response-${index}`,
      'value',
    ] as const);
    const rejectedHeaders = Array.from({ length: 1_025 }, (_, index) => [
      `x-response-${index}`,
      'value',
    ] as const);

    const accepted = await createCapability(async () => ({
      body: '',
      headers: acceptedHeaders,
      status: 200,
    })).execute(validRequest());
    const rejected = await createCapability(async () => ({
      body: '',
      headers: rejectedHeaders,
      status: 200,
    })).execute(validRequest());

    expect(accepted.kind).toBe('response');
    expect(rejected).toEqual({
      code: 'invalid-response',
      kind: 'policy-error',
      requestId: 'request-1',
    });
  });

  it.each([
    ['low status', { body: '', headers: [], status: 99 }],
    ['high status', { body: '', headers: [], status: 600 }],
    ['fractional status', { body: '', headers: [], status: 200.5 }],
    ['missing headers', { body: '', status: 200 }],
    ['non-string body', { body: {}, headers: [], status: 200 }],
    ['unknown field', { body: '', headers: [], status: 200, secret: 'must-not-persist' }],
    ['invalid response header', { body: '', headers: [['bad header', 'value']], status: 200 }],
  ])('rejects malformed executor response: %s', async (_name, response) => {
    const result = await createCapability(
      (async () => response) as HostTransportExecutor
    ).execute(validRequest());

    expect(result).toEqual({
      code: 'invalid-response',
      kind: 'policy-error',
      requestId: 'request-1',
    });
    expect(JSON.stringify(result)).not.toContain('must-not-persist');
  });

  it('rejects sparse, accessor-backed, symbol-keyed, and throwing response values safely', async () => {
    let accessorCalls = 0;
    const sparseHeaders = new Array(2);
    sparseHeaders[1] = ['x-test', 'value'];
    const accessor = { body: '', headers: [], status: 200 } as Record<string, unknown>;
    Object.defineProperty(accessor, 'body', {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return '';
      },
    });
    const throwing = new Proxy({ body: '', headers: [], status: 200 }, {
      ownKeys() {
        throw new Error('must not escape');
      },
    });
    const values: unknown[] = [
      { body: '', headers: sparseHeaders, status: 200 },
      accessor,
      { body: '', headers: [], status: 200, [Symbol('hidden')]: true },
      throwing,
    ];

    for (const value of values) {
      const result = await createCapability(
        (async () => value) as HostTransportExecutor
      ).execute(validRequest());
      expect(result).toMatchObject({ code: 'invalid-response', kind: 'policy-error' });
    }
    expect(accessorCalls).toBe(0);
  });

  it('classifies a revoked proxy rejected during Promise assimilation as a network error', async () => {
    const revoked = Proxy.revocable({ body: '', headers: [], status: 200 }, {});
    revoked.revoke();
    const executor = (() => revoked.proxy) as unknown as HostTransportExecutor;

    const result = await createCapability(executor).execute(validRequest());

    expect(result).toEqual({ kind: 'network-error', requestId: 'request-1' });
  });

  it.each(['synchronous throw', 'rejected promise', 'throwing thenable'])(
    'normalizes %s without exposing raw causes',
    async (kind) => {
      const secret = 'https://user:token@example.invalid/private';
      const executor = (() => {
        if (kind === 'synchronous throw') throw new Error(secret);
        if (kind === 'rejected promise') return Promise.reject(new Error(secret));
        return {
          get then() {
            throw new Error(secret);
          },
        } as unknown as Promise<HostTransportResponse>;
      }) as HostTransportExecutor;

      const result = await createCapability(executor).execute(validRequest());

      expect(result).toEqual({ kind: 'network-error', requestId: 'request-1' });
      expect(JSON.stringify(result)).not.toContain('token');
      expect(JSON.stringify(result)).not.toContain('example.invalid');
    }
  );

  it('normalizes an own throwing then getter on a native executor promise', async () => {
    let thenGetterCalls = 0;
    const execution = Promise.resolve<HostTransportResponse>({
      body: '',
      headers: [],
      status: 200,
    });
    Object.defineProperty(execution, 'then', {
      get() {
        thenGetterCalls += 1;
        throw new Error('SECRET-CAUSE');
      },
    });
    const executor = (() => execution) as HostTransportExecutor;

    const result = await createCapability(executor).execute(validRequest());

    expect(result).toEqual({
      kind: 'response',
      requestId: 'request-1',
      response: { body: '', headers: [], status: 200 },
    });
    expect(thenGetterCalls).toBe(0);
    expect(JSON.stringify(result)).not.toContain('SECRET-CAUSE');
  });

  it('does not invoke the executor for a pre-aborted request', async () => {
    const controller = new AbortController();
    controller.abort();
    const executor = neverCalledExecutor();

    const result = await createCapability(executor).execute(validRequest(controller.signal));

    expect(result).toEqual({ kind: 'cancelled', requestId: 'request-1' });
    expect(executor).not.toHaveBeenCalled();
  });

  it('does not miss abort immediately after listener registration', async () => {
    const controller = new AbortController();
    const signal = controller.signal;
    const original = AbortSignal.prototype.addEventListener;
    const addSpy = vi.spyOn(signal, 'addEventListener').mockImplementation(function (
      this: AbortSignal,
      ...args
    ) {
      original.apply(this, args);
      controller.abort();
    });
    const executor = neverCalledExecutor();

    const result = await createCapability(executor).execute(validRequest(signal));

    expect(result).toEqual({ kind: 'cancelled', requestId: 'request-1' });
    expect(addSpy).toHaveBeenCalledTimes(1);
    expect(executor).not.toHaveBeenCalled();
  });

  it('cancellation during executor invocation wins and consumes its late rejection', async () => {
    const controller = new AbortController();
    const late = deferred<HostTransportResponse>();
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    const processObject = (globalThis as unknown as {
      process: {
        on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
        off(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
      };
    }).process;
    processObject.on('unhandledRejection', onUnhandled);
    const executor: HostTransportExecutor = vi.fn(() => {
      controller.abort();
      return late.promise;
    });
    try {
      const result = await createCapability(executor).execute(validRequest(controller.signal));
      late.reject(new Error('late secret failure'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(result).toEqual({ kind: 'cancelled', requestId: 'request-1' });
      expect(executor).toHaveBeenCalledTimes(1);
      expect(unhandled).toEqual([]);
    } finally {
      processObject.off('unhandledRejection', onUnhandled);
    }
  });

  it('cancellation while pending wins over a late successful response', async () => {
    const controller = new AbortController();
    const late = deferred<HostTransportResponse>();
    const resultPromise = createCapability(() => late.promise).execute(
      validRequest(controller.signal)
    );

    controller.abort();
    late.resolve({ body: 'late', headers: [], status: 200 });

    await expect(resultPromise).resolves.toEqual({ kind: 'cancelled', requestId: 'request-1' });
  });

  it('keeps the first completed response or rejection when a later abort occurs', async () => {
    const responseController = new AbortController();
    const response = await createCapability(async () => ({
      body: '',
      headers: [],
      status: 204,
    })).execute(validRequest(responseController.signal));
    responseController.abort();

    const rejectionController = new AbortController();
    const rejection = await createCapability(async () => {
      throw new Error('network');
    }).execute(validRequest(rejectionController.signal));
    rejectionController.abort();

    expect(response.kind).toBe('response');
    expect(rejection).toEqual({ kind: 'network-error', requestId: 'request-1' });
  });

  it.each(['response', 'rejection', 'cancellation'] as const)(
    'removes its abort listener after %s settlement',
    async (outcome) => {
      const controller = new AbortController();
      const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');
      const pending = deferred<HostTransportResponse>();
      const executor: HostTransportExecutor =
        outcome === 'response'
          ? async () => ({ body: '', headers: [], status: 200 })
          : outcome === 'rejection'
            ? async () => Promise.reject(new Error('network'))
            : () => pending.promise;

      const resultPromise = createCapability(executor).execute(validRequest(controller.signal));
      if (outcome === 'cancellation') controller.abort();
      await resultPromise;

      expect(removeSpy).toHaveBeenCalledTimes(1);
      if (outcome === 'cancellation') pending.resolve({ body: '', headers: [], status: 200 });
    }
  );
});
