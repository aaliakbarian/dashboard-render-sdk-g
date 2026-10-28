import { expect, it } from 'vitest';
import { fixtureDashboard } from '../packages/provider-13/src/testFixtures.test';
import { classifyGrafana13PanelProfile } from '../packages/provider-13/src/preflightProfiles';

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
