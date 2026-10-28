import { expect, it } from 'vitest';
import { isGrafana13PulseTarget } from './contracts';

const aliases: Array<[string, boolean]> = [
  ['plain', true], ['', true], ['~'.repeat(256), true], ['a'.repeat(257), false],
  ['$environment', false], ['price$', false], ['[[environment]]', false], ['plain[[', false],
  ['مرحله', false], ['plain\n', false], ['plain\t', false], ['\u0000', false], ['\u007f', false],
];
it.each(aliases)('checks the exact literal pulse alias %j', (alias, admitted) => {
  const target = { refId: 'A', scenarioId: 'predictable_pulse', alias,
    pulseWave: { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 },
  };
  expect(isGrafana13PulseTarget(target)).toBe(admitted);
});
