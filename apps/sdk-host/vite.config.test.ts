import { describe, expect, it } from 'vitest';

import { providerArtifactChunk } from './vite.config';

describe('SDK host provider artifact chunk ownership', () => {
  it.each([
    ['provider-scenes-CqQkIZKD.js', 'provider-scenes'],
    ['provider-grafana-BnAaAYeL.js', 'provider-grafana'],
    ['provider-rxjs-BK_4wtII.js', 'provider-rxjs'],
    ['provider-emotion-C1j10Ndl.js', 'provider-emotion'],
    ['provider-visualization-AbCdEf12.js', 'provider-visualization'],
    ['provider-tslib-AbCdEf12.js', 'provider-tslib'],
    ['provider-uuid-AbCdEf12.js', 'provider-uuid'],
    ['provider-scenes-dependencies-AbCdEf12.js', 'provider-scenes-dependencies'],
    ['provider-react-dom-external-AbCdEf12.js', 'provider-react-dom-external'],
    ['provider-react-external-AbCdEf12.js', 'provider-react-external'],
    ['rolldown-runtime-C0FnF6B9.js', 'provider-rolldown-runtime'],
    ['esm-AbCdEf12.js', 'provider-scenes-facade'],
    ['history-AbCdEf12.js', 'provider-history'],
    ['micro-memoize-AbCdEf12.js', 'provider-memoize'],
    ['runtimeUi-AbCdEf12.js', 'provider-runtime-ui'],
    ['schemas-AbCdEf12.js', 'provider-schemas'],
    ['string-hash-AbCdEf12.js', 'provider-visualization-support'],
    ['Trans-AbCdEf12.js', 'provider-i18n'],
    ['implementation-CNRMCXrm.js', 'provider-implementation'],
    ['textPlugin-AZ5GFwvD.js', 'feature-text'],
  ])('preserves %s as %s when the host re-bundles the provider', (fileName, expected) => {
    expect(
      providerArtifactChunk(`/workspace/artifacts/sdk/provider-13/assets/${fileName}`)
    ).toBe(expected);
  });

  it('does not claim source-package or unrelated host modules', () => {
    expect(providerArtifactChunk('/workspace/node_modules/@grafana/scenes/dist/esm/index.js')).toBeUndefined();
    expect(providerArtifactChunk('/workspace/apps/sdk-host/src/main.tsx')).toBeUndefined();
  });
});
