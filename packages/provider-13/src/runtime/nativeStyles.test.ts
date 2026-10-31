import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { scopeTableDataGridCss } from './nativeStyles';

describe('native TableNG stylesheet ownership', () => {
  it('keeps every react-data-grid selector inside the dashboard surface', () => {
    const nativeTableCss = scopeTableDataGridCss(readFileSync('node_modules/@grafana/react-data-grid/lib/styles.css', 'utf8'));
    expect(nativeTableCss).toContain('@layer rdg');
    expect(nativeTableCss).toContain('[data-dashboard-render-sdk-g-surface] .');
    expect(nativeTableCss).not.toMatch(/^\.[^{]+\{/m);
    expect(nativeTableCss).not.toMatch(/(^|})\s*(?:html|body|:root|\*)\s*\{/m);
  });
});
