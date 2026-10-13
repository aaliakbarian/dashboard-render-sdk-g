// POC / EXPERIMENT / NOT FOR PRODUCTION
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { assessLazyPanelBundle, type BundleEvidence } from './analyzeBundleEvidence.ts';

const root = resolve('artifacts/experiments/lazy-panel-chunks');
const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8')) as T;
const baseline = readJson<BundleEvidence>('baseline/evidence/bundle-evidence.json');
const artifact = readJson<BundleEvidence>('artifact/evidence/bundle-evidence.json');
const browser = readJson<BundleEvidence>('browser/evidence/bundle-evidence.json');
const network = readJson<{
  probes: Record<string, { requests: readonly string[] }>;
  rendererChunks: Record<string, string>;
}>('browser/network-evidence.json');

const byFile = new Map(
  [...browser.chunks, ...browser.assets].map((item) => [item.fileName, item] as const)
);
const networkCosts = Object.fromEntries(
  Object.entries(network.probes).map(([mode, probe]) => {
    const files = [...new Set(probe.requests)].filter((path) => byFile.has(path));
    return [
      mode,
      {
        files,
        gzipBytes: files.reduce((total, file) => total + (byFile.get(file)?.gzipSize ?? 0), 0),
        rawBytes: files.reduce((total, file) => total + (byFile.get(file)?.rawSize ?? 0), 0),
      },
    ];
  })
);

const singlePanelModes = ['text', 'stat', 'timeseries'] as const;
const commonSinglePanelFiles = singlePanelModes.reduce<Set<string>>((common, mode, index) => {
  const requested = new Set(network.probes[mode]?.requests ?? []);
  return index === 0
    ? requested
    : new Set([...common].filter((file) => requested.has(file)));
}, new Set());
const incrementalNetworkCosts = Object.fromEntries(
  singlePanelModes.map((mode) => {
    const files = [...new Set(network.probes[mode]?.requests ?? [])].filter(
      (file) => byFile.has(file) && !commonSinglePanelFiles.has(file)
    );
    return [
      mode,
      {
        files,
        gzipBytes: files.reduce((total, file) => total + (byFile.get(file)?.gzipSize ?? 0), 0),
        rawBytes: files.reduce((total, file) => total + (byFile.get(file)?.rawSize ?? 0), 0),
      },
    ];
  })
);

function reachable(
  chunks: BundleEvidence['chunks'],
  roots: BundleEvidence['chunks'],
  includeDynamic = false
) {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk] as const));
  const pending = roots.map((chunk) => chunk.fileName);
  const visited = new Set<string>();
  while (pending.length > 0) {
    const name = pending.pop();
    if (!name || visited.has(name)) continue;
    visited.add(name);
    const chunk = byName.get(name);
    if (!chunk) continue;
    pending.push(...chunk.imports, ...(includeDynamic ? chunk.dynamicImports : []));
  }
  return chunks.filter((chunk) => visited.has(chunk.fileName));
}

const summarizeChunks = (chunks: BundleEvidence['chunks']) => ({
  chunks: chunks.map((chunk) => chunk.fileName).sort(),
  gzipBytes: chunks.reduce((total, chunk) => total + chunk.gzipSize, 0),
  rawBytes: chunks.reduce((total, chunk) => total + chunk.rawSize, 0),
});

const baselinePanelSources = baseline.categories.grafanaApplication.filter((source) =>
  /\/plugins\/panel\/(?:text|stat|timeseries)\//.test(source)
);
const baselineEntryPanelSources = [
  ...new Set(
    baseline.chunks
      .filter((chunk) => chunk.isEntry)
      .flatMap((chunk) => chunk.modules)
      .filter((source) => baselinePanelSources.includes(source))
  ),
].sort();
const baselineEntries = baseline.chunks.filter((chunk) => chunk.isEntry);
const baselineInitialClosure = reachable(baseline.chunks, baselineEntries);
const baselineSourcesByPanel = Object.fromEntries(
  singlePanelModes.map((panelId) => [
    panelId,
    baselinePanelSources.filter((source) =>
      source.includes(`/plugins/panel/${panelId === 'timeseries' ? 'timeseries' : panelId}/`)
    ),
  ])
) as Record<(typeof singlePanelModes)[number], string[]>;
const baselineRendererClosures = Object.fromEntries(
  Object.entries(baselineSourcesByPanel).map(([panelId, sources]) => {
    const owners = baseline.chunks.filter((chunk) =>
      chunk.modules.some((moduleId) => sources.includes(moduleId))
    );
    return [panelId, summarizeChunks(reachable(baseline.chunks, owners))];
  })
);
const baselineModuleOwners = new Map<string, Set<string>>();
for (const chunk of baseline.chunks) {
  for (const moduleId of chunk.modules) {
    const owners = baselineModuleOwners.get(moduleId) ?? new Set<string>();
    owners.add(chunk.fileName);
    baselineModuleOwners.set(moduleId, owners);
  }
}
const baselineDuplicatedModules = [...baselineModuleOwners]
  .filter(([, owners]) => owners.size > 1)
  .map(([moduleId, owners]) => ({ moduleId, owners: [...owners].sort() }));
const baselinePanelClosureModules = Object.fromEntries(
  Object.entries(baselineRendererClosures).map(([panelId, closure]) => [
    panelId,
    new Set(
      baseline.chunks
        .filter((chunk) => closure.chunks.includes(chunk.fileName))
        .flatMap((chunk) => chunk.modules)
    ),
  ])
) as Record<string, Set<string>>;
const baselineSharedModules = [
  ...new Set(
    [...baselineModuleOwners.keys()].filter(
      (moduleId) =>
        Object.values(baselinePanelClosureModules).filter((modules) => modules.has(moduleId)).length > 1
    )
  ),
].sort();
const result = {
  artifact: assessLazyPanelBundle(artifact),
  baseline: {
    applicationPanelSources: baselinePanelSources,
    directEntryPanelSources: baselineEntryPanelSources,
    duplicatedModules: baselineDuplicatedModules,
    externalReactSpecifiers: [
      ...new Set(
        baseline.chunks
          .flatMap((chunk) => chunk.imports)
          .filter((id) => /^react(?:-dom)?(?:\/|$)/.test(id))
      ),
    ].sort(),
    gzipJsBytes: baseline.chunks.reduce((total, chunk) => total + chunk.gzipSize, 0),
    initialClosure: summarizeChunks(baselineInitialClosure),
    initialRendererSources: [
      ...new Set(
        baselineInitialClosure
          .flatMap((chunk) => chunk.modules)
          .filter((moduleId) => baselinePanelSources.includes(moduleId))
      ),
    ].sort(),
    jsChunks: baseline.chunks.length,
    rawJsBytes: baseline.chunks.reduce((total, chunk) => total + chunk.rawSize, 0),
    reactImplementationModules: baseline.moduleIds
      .filter((id) => /\/node_modules\/(?:react|react-dom)\//.test(id))
      .sort(),
    rendererClosures: baselineRendererClosures,
    sharedModules: baselineSharedModules,
  },
  generatedAt: 'reproducible-local-experiment',
  incrementalNetworkCosts,
  networkCosts,
  rendererChunks: network.rendererChunks,
};

mkdirSync(root, { recursive: true });
writeFileSync(resolve(root, 'comparison.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
