import { expect, it } from 'vitest';
import { createGrafana13TemplateSrv } from './templateSrv';

it('leaves literal pulse aliases intact and rejects variable/format execution', () => {
  const service = createGrafana13TemplateSrv();
  expect(service.replace('Raw Signal')).toBe('Raw Signal');
  expect(service.getVariables()).toEqual([]);
  expect(service.containsTemplate('$other')).toBe(true);
  for (const input of ['$other', '${other}', '[[other]]']) expect(() => service.replace(input)).toThrow();
  expect(() => service.replace('literal', {}, 'json')).toThrow();
});
