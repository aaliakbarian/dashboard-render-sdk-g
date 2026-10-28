export const GRAFANA_13_SOURCE_REVISION =
  '6193dc03311b631b9727b560d24369e683dc396e' as const;

export const GRAFANA_13_APPLICATION_SOURCES = Object.freeze([
  'public/app/plugins/panel/text/panelcfg.gen.ts',
  'public/app/plugins/panel/text/v1/TextPanel.tsx',
] as const);

export class Grafana13SourceIdentityError extends Error {
  override readonly name = 'Grafana13SourceIdentityError';
  readonly code = 'grafana-source-identity-invalid' as const;
}

export function assertGrafana13SourceIdentity(identity: {
  readonly dirty: boolean;
  readonly revision: string;
}): void {
  if (identity.revision !== GRAFANA_13_SOURCE_REVISION) {
    throw new Grafana13SourceIdentityError(
      'The provider build requires the exact pinned Grafana OSS source revision.'
    );
  }
  if (identity.dirty) {
    throw new Grafana13SourceIdentityError(
      'The provider build requires a clean pinned Grafana OSS source checkout.'
    );
  }
}
