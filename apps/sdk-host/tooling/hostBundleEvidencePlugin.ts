import type { Plugin, Rolldown } from 'vite';

function evidenceId(id: string, repositoryRoot: string): string {
  const normalized = id.replace(/^\0+/, '').replaceAll('\\', '/');
  const repository = repositoryRoot.replaceAll('\\', '/').replace(/\/$/, '');
  return normalized.startsWith(`${repository}/`)
    ? `<repo>/${normalized.slice(repository.length + 1)}`
    : normalized;
}

export function hostBundleEvidencePlugin(repositoryRoot: string): Plugin {
  return {
    name: 'sdk-host-bundle-evidence',
    generateBundle(_outputOptions, bundle) {
      const chunks = Object.values(bundle)
        .filter((entry): entry is Rolldown.OutputChunk => entry.type === 'chunk')
        .map((chunk) => ({
          fileName: chunk.fileName,
          modules: Object.keys(chunk.modules)
            .map((id) => evidenceId(id, repositoryRoot))
            .sort(),
        }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
      const moduleIds = [...this.getModuleIds()]
        .map((id) => evidenceId(id, repositoryRoot))
        .sort();
      this.emitFile({
        fileName: 'evidence/bundle-evidence.json',
        source: `${JSON.stringify({ chunks, moduleIds }, null, 2)}\n`,
        type: 'asset',
      });
    },
  };
}
