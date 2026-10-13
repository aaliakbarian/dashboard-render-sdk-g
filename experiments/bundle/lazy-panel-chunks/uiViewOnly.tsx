// POC / EXPERIMENT / NOT FOR PRODUCTION
export { ScrollContainer } from 'grafana-experiment-ui-scroll-container';
export { useStyles2 } from 'grafana-experiment-ui-theme-context';

export class UnsupportedTextCodeModeError extends Error {
  readonly code = 'text-code-mode-unsupported';
  constructor() {
    super('The independent Text chunk supports the controlled Markdown view mode only.');
    this.name = 'UnsupportedTextCodeModeError';
  }
}

export function CodeEditor(): never {
  throw new UnsupportedTextCodeModeError();
}
