export { convertFieldType } from 'grafana-provider13-native-convert-field';
export { NULL_EXPAND, NULL_REMOVE, NULL_RETAIN, maybeSortFrame } from 'grafana-provider13-native-join-frames';
export { nullToUndefThreshold } from 'grafana-provider13-native-null-to-undef';
export { findNumericFieldMinMax } from 'grafana-provider13-native-field-overrides';

/** Exact no-override subset used by the admitted Bar chart profile. */
export function decoupleHideFromState(
  frames: Array<{ fields: Array<{ config: { custom?: Record<string, any> }; state?: Record<string, any> }> }>,
  fieldConfig: { defaults: { custom?: { hideFrom?: Record<string, boolean> } }; overrides: readonly unknown[] }
) {
  if (fieldConfig.overrides.length !== 0) throw new Error('Field overrides are outside the admitted Bar chart profile.');
  for (const frame of frames) {
    for (const field of frame.fields) {
      const configured = { legend: false, tooltip: false, viz: false, ...fieldConfig.defaults.custom?.hideFrom };
      const runtime = field.config.custom?.hideFrom;
      field.state = { ...field.state, hideFrom: { ...runtime } };
      field.config.custom = { ...field.config.custom, hideFrom: configured };
    }
  }
}
