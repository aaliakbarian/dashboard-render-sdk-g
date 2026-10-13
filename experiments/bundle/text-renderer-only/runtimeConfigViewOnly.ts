// POC / EXPERIMENT / NOT FOR PRODUCTION
// Replaces the application-owned app/core/config wrapper with the only Runtime
// value read by the exact TextPanel source.
import { config } from 'grafana-experiment-runtime-config';

const textViewRuntimeConfig = Object.freeze({
  disableSanitizeHtml: Boolean(config.disableSanitizeHtml),
});

export default textViewRuntimeConfig;
