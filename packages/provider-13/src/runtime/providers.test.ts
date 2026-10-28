import { describe, expect, it } from 'vitest';

import { createGrafana13ProviderElement } from './providers';

describe('createGrafana13ProviderElement', () => {
  it('wraps children with the exact Runtime-created theme context', () => {
    const Provider = Symbol('theme-provider');
    const theme = { isLight: true };
    const child = { child: true };
    const element = createGrafana13ProviderElement(
      { ThemeContext: { Provider } as never, theme },
      child as never
    );
    expect(element.type).toBe(Provider);
    expect(element.props).toMatchObject({ children: child, value: theme });
  });
});
