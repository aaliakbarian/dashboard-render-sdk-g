// POC / EXPERIMENT / NOT FOR PRODUCTION
// This is the exact Phase 0 Text v1 module used to measure the inherited
// renderer + editor + migration registration closure.
import type { PanelPlugin } from '@grafana/data';

import { plugin } from 'grafana-experiment-text-baseline';

export const baselineTextPlugin: PanelPlugin = plugin;
