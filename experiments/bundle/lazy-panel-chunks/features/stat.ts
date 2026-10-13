// POC / EXPERIMENT / NOT FOR PRODUCTION
/// <reference path="../grafana-source-modules.d.ts" />

import { PanelPlugin } from '@grafana/data';

import { StatPanel } from 'grafana-experiment-stat-renderer';

// Renderer-only: authoring options, migrations, presets, and suggestions remain
// outside this chunk. Runtime registries preserve the fixture field config.
export const plugin = new PanelPlugin(StatPanel).useFieldConfig().setNoPadding();

