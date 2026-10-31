import { expect, it } from 'vitest';
import { fixtureDashboard } from '../packages/provider-13/src/testFixtures.test';
import { classifyGrafana13PanelProfile } from '../packages/provider-13/src/preflightProfiles';
import { partialPreflightGrafana13DashboardV1 } from '../packages/provider-13/src/partialPreflight';
import { grafana13Provider } from '../packages/provider-13/src/provider';
import { validateProviderCompatibilityManifest } from '@dashboard-render-sdk-g/provider-contract';
import { decodeGrafana13DashboardV1Value } from '../packages/provider-13/src/dashboardDto';

const user = process.env.POC_GRAFANA_VERIFY_USER;
const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;
function differencePaths(a: any, b: any, path = '$'): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => differencePaths(a[k], b[k], `${path}.${k}`));
  return [path];
}
it.skipIf(!user || !password)('retrieves the live native profiles without material normalization drift', async () => {
  const uid = 'grsdk-phase0-poc';
  const response = await fetch(`http://grafana:3000/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/${uid}/dto`, {
    headers: { Authorization: `Basic ${btoa(`${user}:${password}`)}` }, redirect: 'error',
  });
  expect(response.status).toBe(200);
  const dto = await response.json() as any;
  for (const type of ['stat', 'timeseries']) {
    const panel = dto.spec.panels.find((p: any) => p.type === type);
    const expected = fixtureDashboard(uid).spec.panels.find(p => p.type === type);
    expect(differencePaths(panel, expected), `${type} changed material paths only`).toEqual(['$.fieldConfig.defaults.thresholds.steps.0.value']);
    expect(panel.fieldConfig.defaults.thresholds.steps[0]).not.toHaveProperty('value');
    expect(classifyGrafana13PanelProfile(panel).kind).toBe('supported');
  }
});

it.skipIf(!user || !password)('retrieves exact live Gauge/Bar gauge/Bar chart DTOs and leaves Table/Pie fallback under the shipped manifest', async () => {
  const uid = 'drsdk-g-phase2-visualizations';
  const response = await fetch(`http://grafana:3000/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/${uid}/dto`, {
    headers: { Authorization: `Basic ${btoa(`${user}:${password}`)}` }, redirect: 'error',
  });
  expect(response.status).toBe(200);
  const dto = await response.json() as any;
  for (const type of ['gauge', 'bargauge']) {
    const panel = dto.spec.panels.find((p: any) => p.type === type);
    const expected = fixtureDashboard(uid).spec.panels.find(p => p.type === type);
    expect(differencePaths(panel, expected), `${type} changed material paths only`).toEqual(['$.fieldConfig.defaults.thresholds.steps.0.value']);
    expect(classifyGrafana13PanelProfile(panel).kind).toBe('supported');
  }
  const barChart = dto.spec.panels.find((panel: any) => panel.type === 'barchart');
  const expectedBarChart = fixtureDashboard(uid).spec.panels.find(panel => panel.type === 'barchart');
  expect(differencePaths(barChart, expectedBarChart)).toEqual([]);
  expect(classifyGrafana13PanelProfile(barChart).kind).toBe('supported');
  const manifest = validateProviderCompatibilityManifest(grafana13Provider.manifest);
  if (!manifest.valid) throw new Error('Expected shipped manifest');
  const decoded = decodeGrafana13DashboardV1Value(dto, { namespace: 'default', requestId: 'expanded-live-dto', uid });
  expect(decoded.kind).toBe('success');
  if (decoded.kind !== 'success') throw new Error('Expected decoded live DTO');
  const result = partialPreflightGrafana13DashboardV1(decoded.value, manifest);
  expect(result).toMatchObject({ kind: 'renderable', supportedPanelCount: 6, unsupportedPanelCount: 2 });
  if (result.kind === 'renderable') {
    expect(result.panels.filter(p => p.kind === 'supported').map(p => p.panelType)).toContain('barchart');
    expect(result.panels.filter(p => p.kind === 'unsupported').map(p => p.panelType)).toEqual(['table', 'piechart']);
  }
});
