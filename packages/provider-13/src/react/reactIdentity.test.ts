import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import { describe, expect, it, vi } from 'vitest';

import type { HostReactRuntime } from '@dashboard-render-sdk-g/provider-contract';

import {
  GRAFANA_13_REACT_CELL,
  Grafana13ReactCompatibilityError,
  assertCompatibleHostReactRuntime,
  loadAfterHostReactAdmission,
  readTrustedProviderReactVersions,
} from './reactIdentity';

function compatibleHostReact(): HostReactRuntime {
  return {
    identities: {
      jsxDevRuntime: JsxDevRuntime,
      jsxRuntime: JsxRuntime,
      react: React,
      reactDom: ReactDOM,
      reactDomClient: ReactDOMClient,
    },
    versions: { react: '19.2.8', reactDom: '19.2.8' },
  };
}

async function expectSanitizedAdmissionFailure(
  hostReact: HostReactRuntime,
  secret: string,
  loader: ReturnType<typeof vi.fn<() => Promise<{ loaded: boolean }>>>
) {
  const failure = await loadAfterHostReactAdmission(hostReact, loader).catch(
    (error: unknown) => error
  );

  expect(failure).toBeInstanceOf(Grafana13ReactCompatibilityError);
  expect(failure).toMatchObject({ code: 'runtime-react-incompatible' });
  expect(failure).not.toHaveProperty('cause');
  expect(String(failure)).not.toContain(secret);
  expect(JSON.stringify(failure)).not.toContain(secret);
  expect(loader).not.toHaveBeenCalled();
}

describe('Grafana 13 host React admission', () => {
  it('reads versions from trusted bundler namespace accessors without relaxing host reflection', () => {
    const ReactNamespace = Object.defineProperty({}, 'version', {
      enumerable: true,
      get: () => '19.2.8',
    });
    const ReactDOMNamespace = Object.defineProperty({}, 'version', {
      enumerable: true,
      get: () => '19.2.8',
    });

    expect(readTrustedProviderReactVersions(ReactNamespace, ReactDOMNamespace)).toEqual({
      react: '19.2.8',
      reactDom: '19.2.8',
    });
  });

  it('accepts only the exact supported version cell and five provider identities', () => {
    const host = compatibleHostReact();
    const admitted = assertCompatibleHostReactRuntime(host);

    expect(admitted.hostReact).toBe(host);
    expect(admitted.cell).toBe(GRAFANA_13_REACT_CELL);
    expect(Object.isFrozen(admitted)).toBe(true);
  });

  it.each([
    ['react', '19.2.7', '19.2.8'],
    ['reactDom', '19.2.8', '19.2.7'],
  ] as const)('rejects an unsupported %s version before loading implementation code', async (_name, react, reactDom) => {
    const host = compatibleHostReact();
    const loader = vi.fn(async () => ({ loaded: true }));

    await expect(
      loadAfterHostReactAdmission(
        { ...host, versions: { react, reactDom } },
        loader
      )
    ).rejects.toMatchObject({
      code: 'runtime-react-incompatible',
      name: 'Grafana13ReactCompatibilityError',
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it.each([
    ['react', { version: '19.2.7' }],
    ['reactDom', {}],
  ] as const)(
    'rejects correct claimed strings when the actual %s namespace identity is wrong',
    async (identity, actualNamespace) => {
      const host = compatibleHostReact();
      const loader = vi.fn(async () => ({ loaded: true }));

      await expect(
        loadAfterHostReactAdmission(
          {
            ...host,
            identities: { ...host.identities, [identity]: actualNamespace },
          },
          loader
        )
      ).rejects.toMatchObject({
        code: 'runtime-react-incompatible',
        message: expect.stringMatching(/runtime identity/i),
      });
      expect(loader).not.toHaveBeenCalled();
    }
  );

  it('turns a hostile namespace version reflection failure into a typed sanitized rejection', async () => {
    const host = compatibleHostReact();
    const loader = vi.fn(async () => ({ loaded: true }));
    const secret = 'provider-react-version-secret';
    const hostileReact = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error(secret);
        },
      }
    );

    const failure = await loadAfterHostReactAdmission(
      {
        ...host,
        identities: { ...host.identities, react: hostileReact },
      },
      loader
    ).catch((error: unknown) => error);

    expect(failure).toMatchObject({
      code: 'runtime-react-incompatible',
      message: expect.stringMatching(/runtime identity/i),
    });
    expect(JSON.stringify(failure)).not.toContain(secret);
    expect(loader).not.toHaveBeenCalled();
  });

  it.each(['versions', 'identities'] as const)(
    'does not invoke a throwing top-level %s accessor',
    async (property) => {
      const secret = `top-level-${property}-secret`;
      const loader = vi.fn(async () => ({ loaded: true }));
      let invoked = false;
      const host = compatibleHostReact();
      const hostile = {
        ...host,
        get [property]() {
          invoked = true;
          throw new Error(secret);
        },
      } as HostReactRuntime;

      await expectSanitizedAdmissionFailure(hostile, secret, loader);
      expect(invoked).toBe(false);
    }
  );

  it.each(['react', 'reactDom'] as const)(
    'does not invoke a throwing claimed %s version accessor',
    async (property) => {
      const secret = `claimed-${property}-secret`;
      const loader = vi.fn(async () => ({ loaded: true }));
      let invoked = false;
      const host = compatibleHostReact();
      const versions = {
        ...host.versions,
        get [property]() {
          invoked = true;
          throw new Error(secret);
        },
      };

      await expectSanitizedAdmissionFailure(
        { ...host, versions } as HostReactRuntime,
        secret,
        loader
      );
      expect(invoked).toBe(false);
    }
  );

  it('normalizes revoked claimed-version and identity containers', async () => {
    const host = compatibleHostReact();
    const versions = Proxy.revocable(host.versions, {});
    const identities = Proxy.revocable(host.identities, {});
    versions.revoke();
    identities.revoke();

    await expectSanitizedAdmissionFailure(
      { ...host, versions: versions.proxy },
      'revoked-version-secret',
      vi.fn(async () => ({ loaded: true }))
    );
    await expectSanitizedAdmissionFailure(
      { ...host, identities: identities.proxy },
      'revoked-identity-secret',
      vi.fn(async () => ({ loaded: true }))
    );
  });

  it('does not invoke a throwing nested identity accessor', async () => {
    const secret = 'nested-identity-secret';
    const loader = vi.fn(async () => ({ loaded: true }));
    let invoked = false;
    const host = compatibleHostReact();
    const identities = {
      ...host.identities,
      get react() {
        invoked = true;
        throw new Error(secret);
      },
    };

    await expectSanitizedAdmissionFailure(
      { ...host, identities } as unknown as HostReactRuntime,
      secret,
      loader
    );
    expect(invoked).toBe(false);
  });

  it.each([
    'react',
    'reactDom',
    'reactDomClient',
    'jsxRuntime',
    'jsxDevRuntime',
  ] as const)('rejects a duplicate %s identity before loading implementation code', async (identity) => {
    const host = compatibleHostReact();
    const loader = vi.fn(async () => ({ loaded: true }));
    const duplicate = {
      ...host,
      identities: { ...host.identities, [identity]: {} },
    };

    await expect(loadAfterHostReactAdmission(duplicate, loader)).rejects.toBeInstanceOf(
      Grafana13ReactCompatibilityError
    );
    expect(loader).not.toHaveBeenCalled();
  });

  it('loads implementation code only after successful React admission', async () => {
    const implementation = Object.freeze({ loaded: true });
    const loader = vi.fn(async () => implementation);

    await expect(loadAfterHostReactAdmission(compatibleHostReact(), loader)).resolves.toBe(
      implementation
    );
    expect(loader).toHaveBeenCalledOnce();
  });
});
