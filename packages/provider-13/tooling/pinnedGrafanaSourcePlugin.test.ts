import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { pinnedGrafanaSourcePlugin } from './pinnedGrafanaSourcePlugin';

describe('provider-13 pinned Grafana source plugin', () => {
  it('resolves only the exact Text renderer alias and its generated config import', () => {
    const root = mkdtempSync(join(tmpdir(), 'provider-13-source-'));
    try {
      mkdirSync(join(root, 'v1'));
      writeFileSync(join(root, 'v1/TextPanel.tsx'), "export * from '../panelcfg.gen';");
      writeFileSync(join(root, 'panelcfg.gen.ts'), 'export const value = true;');
      const plugin = pinnedGrafanaSourcePlugin({
        entryAlias: 'grafana-provider13-text-renderer',
        entrypoint: 'v1/TextPanel.tsx',
        sourceRoot: root,
      });
      const resolveId = plugin.resolveId as (source: string, importer?: string) => unknown;
      const entry = String(resolveId('grafana-provider13-text-renderer'));

      expect(entry).toContain('provider-13-pinned-grafana-source:text:');
      expect(resolveId('../panelcfg.gen', entry)).toContain('panelcfg.gen.ts.js');
      expect(resolveId('grafana-provider13-other-renderer')).toBeNull();
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it('rejects forged virtual IDs that escape the pinned source root', () => {
    const plugin = pinnedGrafanaSourcePlugin({
      entryAlias: 'grafana-provider13-text-renderer',
      entrypoint: 'v1/TextPanel.tsx',
      sourceRoot: '/grafana/public/app/plugins/panel/text',
    });
    const load = plugin.load as (id: string) => unknown;

    expect(() =>
      load('\0provider-13-pinned-grafana-source:text:../../../../app.ts.js')
    ).toThrow(/outside the audited source root/i);
  });
});
