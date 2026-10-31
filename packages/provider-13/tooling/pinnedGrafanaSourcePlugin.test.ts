import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { pinnedGrafanaSourcePlugin } from './pinnedGrafanaSourcePlugin';

describe('provider-13 pinned Grafana source plugin', () => {
  it('isolates the TestData namespace and refuses unreviewed files within its root', () => {
    const plugin = pinnedGrafanaSourcePlugin({ allowedEntryImporters: ['/provider/testDataPlugin.ts'], entryAlias: 'grafana-provider13-testdata-runtime',
      entrypoint: 'datasource.ts', sourceRoot: '/grafana/testdata', feature: 'testdata', reviewedFiles: ['datasource.ts'] });
    const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;
    const load = plugin.load as (id: string) => unknown;
    expect(resolveId('grafana-provider13-testdata-runtime', '/provider/testDataPlugin.ts')).toBe('\0provider-13-pinned-grafana-source:testdata:datasource.ts.js');
    expect(() => load('\0provider-13-pinned-grafana-source:testdata:module.tsx.js')).toThrow(/reviewed/i);
    expect(load('\0provider-13-pinned-grafana-source:text:datasource.ts.js')).toBeNull();
  });
  it('resolves only the exact Text renderer alias and its generated config import', () => {
    const root = mkdtempSync(join(tmpdir(), 'provider-13-source-'));
    try {
      mkdirSync(join(root, 'v1'));
      writeFileSync(join(root, 'v1/TextPanel.tsx'), "export * from '../panelcfg.gen';");
      writeFileSync(join(root, 'panelcfg.gen.ts'), 'export const value = true;');
      const plugin = pinnedGrafanaSourcePlugin({
        allowedEntryImporters: ['/provider/textPlugin.ts'],
        entryAlias: 'grafana-provider13-text-renderer',
        entrypoint: 'v1/TextPanel.tsx',
        sourceRoot: root,
      });
      const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;
      const entry = String(resolveId('grafana-provider13-text-renderer', '/provider/textPlugin.ts'));

      expect(entry).toContain('provider-13-pinned-grafana-source:text:');
      expect(resolveId('../panelcfg.gen', entry)).toContain('panelcfg.gen.ts.js');
      expect(resolveId('grafana-provider13-other-renderer')).toBeNull();
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('rejects forged virtual IDs that escape the pinned source root', () => {
    const plugin = pinnedGrafanaSourcePlugin({
      allowedEntryImporters: ['/provider/textPlugin.ts'],
      entryAlias: 'grafana-provider13-text-renderer',
      entrypoint: 'v1/TextPanel.tsx',
      sourceRoot: '/grafana/public/app/plugins/panel/text',
    });
    const load = plugin.load as (id: string) => unknown;

    expect(() =>
      load('\0provider-13-pinned-grafana-source:text:../../../../app.ts.js')
    ).toThrow(/outside the audited source root/i);
  });

  it('allows an entry alias only from its exact reviewed importer', () => {
    const plugin = pinnedGrafanaSourcePlugin({
      allowedEntryImporters: ['/provider/src/runtime/viewOnly/tableUiUnstable.ts'],
      entryAlias: 'grafana-provider13-native-table-flat',
      entrypoint: 'packages/grafana-ui/src/components/Table/TableNG/TableFlat.tsx',
      sourceRoot: '/grafana',
    });
    const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;

    expect(resolveId(
      'grafana-provider13-native-table-flat',
      '/provider/src/runtime/viewOnly/tableUiUnstable.ts'
    )).toContain('TableFlat.tsx.js');
    expect(resolveId('grafana-provider13-native-table-flat', '/provider/tooling/lookalike.ts')).toBeNull();
    expect(resolveId(
      'grafana-provider13-native-table-flat',
      '/provider/lookalike/src/runtime/viewOnly/tableUiUnstable.ts'
    )).toBeNull();
    expect(resolveId('grafana-provider13-native-table-flat')).toBeNull();
  });
});
