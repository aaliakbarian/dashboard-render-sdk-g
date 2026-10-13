// POC / EXPERIMENT / NOT FOR PRODUCTION
// The exact upstream Text renderer imports CodeEditor for an unsupported Code
// mode. The controlled view profile admits Markdown only, so this facade keeps
// the real published ScrollContainer/theme helpers while failing closed if the
// excluded Code path is ever reached.
export { ScrollContainer } from 'grafana-experiment-ui-scroll-container';
export { useStyles2 } from 'grafana-experiment-ui-theme-context';

export class UnsupportedTextCodeModeError extends Error {
  readonly code = 'text-code-mode-unsupported';

  constructor() {
    super('The experimental Text renderer-only profile supports Markdown view mode only.');
    this.name = 'UnsupportedTextCodeModeError';
  }
}

export function CodeEditor(): never {
  throw new UnsupportedTextCodeModeError();
}
