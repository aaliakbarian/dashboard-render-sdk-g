import { expect, it } from 'vitest';
import { installGrafana13FieldConfig } from './fieldConfig';
it('installs only six standard processors once and retains their exact identities', () => {
  let init: any; let installs = 0;
  const registry = { setInit(value: any) { installs++; init = value; } };
  const processors = { stringOverrideProcessor: () => 'value', identityOverrideProcessor: (v: unknown) => v,
    numberOverrideProcessor: () => 42, thresholdsOverrideProcessor: () => 'thresholds', valueMappingsOverrideProcessor: () => 'mappings' };
  installGrafana13FieldConfig(registry, processors as never);
  installGrafana13FieldConfig(registry, processors as never);
  const items = init();
  expect(installs).toBe(1); expect(items.map((i: any) => i.id)).toEqual(['unit', 'color', 'mappings', 'thresholds', 'min', 'max']);
  expect(items[0].process).toBe(processors.stringOverrideProcessor); expect(items[5].process).toBe(processors.numberOverrideProcessor);
  expect(items.every((i: any) => i.editor() === null && i.override() === null)).toBe(true);
  expect(() => installGrafana13FieldConfig(registry, { ...processors, numberOverrideProcessor: () => 43 } as never)).toThrow();
});
