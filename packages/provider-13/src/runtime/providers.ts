import { createElement, type Context, type ReactElement, type ReactNode } from 'react';

export interface Grafana13ProviderValues {
  readonly ThemeContext: Context<{ readonly isLight: boolean }>;
  readonly theme: { readonly isLight: boolean };
}

export function createGrafana13ProviderElement(
  values: Grafana13ProviderValues,
  children: ReactNode
): ReactElement {
  return createElement(values.ThemeContext.Provider, { value: values.theme }, children);
}
