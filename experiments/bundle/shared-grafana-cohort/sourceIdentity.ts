// POC / EXPERIMENT / NOT FOR PRODUCTION
import { RUNTIME_ONLY_APPLICATION_SOURCES } from '../testdata-runtime-only/sourceIdentity.ts';
import { PANEL_APPLICATION_SOURCES } from '../lazy-panel-chunks/sourceIdentity.ts';

export const GRAFANA_SOURCE_COMMIT = '6193dc03311b631b9727b560d24369e683dc396e' as const;
export const GRAFANA_SOURCE_VERSION = '13.2.3' as const;
export const PROVIDER_FEATURE_IDS = ['text', 'stat', 'timeseries', 'testdata'] as const;

export const FEATURE_APPLICATION_SOURCES = {
  text: PANEL_APPLICATION_SOURCES.text,
  stat: PANEL_APPLICATION_SOURCES.stat,
  timeseries: PANEL_APPLICATION_SOURCES.timeseries,
  testdata: RUNTIME_ONLY_APPLICATION_SOURCES,
} as const;

export const REVIEWED_APPLICATION_SOURCES = [
  ...new Set(Object.values(FEATURE_APPLICATION_SOURCES).flat()),
] as const;

export const PACKAGE_VERSIONS = {
  '@emotion/css': '11.13.5',
  '@emotion/react': '11.14.0',
  '@grafana/data': '13.2.3',
  '@grafana/i18n': '13.2.3',
  '@grafana/runtime': '13.2.3',
  '@grafana/scenes': '8.13.5',
  '@grafana/schema': '13.2.3',
  '@grafana/ui': '13.2.3',
  react: '19.2.8',
  'react-dom': '19.2.8',
  rxjs: '7.8.2',
  uplot: '1.6.32',
} as const;

