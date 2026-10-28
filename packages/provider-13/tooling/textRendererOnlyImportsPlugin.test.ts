import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { textRendererOnlyImportsPlugin } from './textRendererOnlyImportsPlugin';

describe('provider-13 Text renderer-only imports', () => {
  it('replaces only the audited renderer imports with provider-owned leaf shims', () => {
    const providerRoot = '/repo/packages/provider-13';
    const sourceRoot = '/grafana/public/app/plugins/panel/text';
    const plugin = textRendererOnlyImportsPlugin({ providerRoot, sourceRoot });
    const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;
    const importer = '\0provider-13-pinned-grafana-source:text:v1/TextPanel.tsx.js';

    expect(resolveId('@grafana/data', importer)).toBe(
      resolve(providerRoot, 'tooling/viewOnly/data.ts')
    );
    expect(resolveId('@grafana/ui', importer)).toBe(
      resolve(providerRoot, 'tooling/viewOnly/ui.tsx')
    );
    expect(resolveId('app/core/config', importer)).toBe(
      resolve(providerRoot, 'tooling/viewOnly/runtimeConfig.ts')
    );
    expect(resolveId('@grafana/ui', '/repo/host.ts')).toBeNull();
  });

  it('keeps the published UI ThemeContext on the exact data ThemeContext leaf', () => {
    const providerRoot = '/repo/packages/provider-13';
    const plugin = textRendererOnlyImportsPlugin({
      providerRoot,
      sourceRoot: '/grafana/public/app/plugins/panel/text',
    });
    const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;

    expect(
      resolveId(
        '@grafana/data',
        '/repo/node_modules/@grafana/ui/dist/esm/themes/ThemeContext.mjs'
      )
    ).toBe('/repo/node_modules/@grafana/data/dist/esm/themes/context.mjs');
  });

  it('maps the provider Text bridge to the published PanelPlugin leaf', () => {
    const providerRoot = '/repo/packages/provider-13';
    const plugin = textRendererOnlyImportsPlugin({
      providerRoot,
      sourceRoot: '/grafana/public/app/plugins/panel/text',
    });
    const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;

    expect(
      resolveId(
        'grafana-provider13-data-panel-plugin',
        '/repo/packages/provider-13/src/panels/textPlugin.ts'
      )
    ).toBe('/repo/node_modules/@grafana/data/dist/esm/panel/PanelPlugin.mjs');
  });
});
