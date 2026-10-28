import { expect, it } from 'vitest';
import { installGrafana13Transformations } from './transformations';
it('installs only the exact rename operator and rejects registry replacement', async () => {
  let init: any; let count = 0;
  const registry = { setInit(value: any) { count++; init = value; } };
  const transform = { id: 'renameByRegex', name: 'Rename', defaultOptions: {} } as never;
  installGrafana13Transformations(registry, transform);
  installGrafana13Transformations(registry, transform);
  expect(count).toBe(1); expect(init().map((i: any) => i.id)).toEqual(['renameByRegex']);
  expect(await init()[0].transformation()).toBe(transform);
  expect(() => installGrafana13Transformations(registry, { id: 'other' } as never)).toThrow();
});
