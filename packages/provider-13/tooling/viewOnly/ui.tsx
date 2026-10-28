export { ScrollContainer } from 'grafana-provider13-ui-scroll-container';
export { useStyles2 } from 'grafana-provider13-ui-theme-context';

export class UnsupportedTextCodeModeError extends Error {
  override readonly name = 'UnsupportedTextCodeModeError';
  readonly code = 'text-code-mode-unsupported' as const;
}

export function CodeEditor(): never {
  throw new UnsupportedTextCodeModeError(
    'The provider supports only the admitted Markdown view-only Text profile.'
  );
}
