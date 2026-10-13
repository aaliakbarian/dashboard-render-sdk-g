// POC / EXPERIMENT / NOT FOR PRODUCTION
import { config } from 'grafana-experiment-runtime-config';

export default Object.freeze({ disableSanitizeHtml: Boolean(config.disableSanitizeHtml) });
