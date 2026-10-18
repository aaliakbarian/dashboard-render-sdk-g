// POC / EXPERIMENT / NOT FOR PRODUCTION
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

import strictCspConfig from '../../security/strict-csp/vite.provider.config.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const inheritedBuild = strictCspConfig.build ?? {};
const inheritedRollup = inheritedBuild.rollupOptions ?? {};
const inheritedOutput = Array.isArray(inheritedRollup.output) ? inheritedRollup.output[0] : inheritedRollup.output;

function productionShapedLifecycleTransform(): Plugin {
  return {
    enforce: 'pre',
    name: 'style-lifecycle-production-shape',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/');
      if (!normalized.endsWith('/experiments/styling/portal-focus-zindex/providerRuntime.tsx')) return;

      const cacheCandidates = [
        "const providerCache = createCache({ key: 'grsdk-provider' });",
        "const providerCache = createCache({ key: 'grsdk-provider', nonce: globalThis.__STRICT_CSP_PROVIDER_CONFIG__!.nonce });",
      ];
      const cacheSource = cacheCandidates.find((candidate) => code.includes(candidate));
      if (!cacheSource) throw new Error('Pinned provider Emotion cache seam changed.');

      const portalSource = 'const releasePortalRoot = acquireProviderPortalRoot();';
      const panelSource = /(await Promise\.all\([^\n]*provider\.panels\.importPanelPlugin\(id\)\)\);)\n\s*if \(disposed\) acquired\.release\(\);\n\s*else \{/;
      const scenesSource = 'const scenes: PocDashboardSceneRoot[] = [];';
      const scenePushSource = 'scenes.push(scene);';
      const sceneInspectSource = 'scenes: scenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),';
      const harnessCss = "import '../../bundle/lazy-panel-chunks/browser.css';";
      const runtimeCatalogSource = '});\nconst runtimePanelCatalog = Object.freeze({';
      const initialDashboardSource = 'const [showPrimary, setShowPrimary] = useState(true);';
      for (const seam of [portalSource, scenesSource, scenePushSource, sceneInspectSource, harnessCss, runtimeCatalogSource, initialDashboardSource]) {
        if (!code.includes(seam)) throw new Error(`Pinned lifecycle seam changed: ${seam}`);
      }
      if (!panelSource.test(code)) throw new Error('Pinned lifecycle panel-preload seam changed.');

      return code
        .replace(cacheSource, 'const providerCache = globalThis.__STYLE_LIFECYCLE_PROVIDER_CACHE__!;')
        .replace(harnessCss, '')
        .replace(scenesSource, 'let observedSceneReadyCount = 0;')
        .replace(scenePushSource, "observedSceneReadyCount += 1; globalThis.__STYLE_LIFECYCLE_SCENE_REFS__ = (globalThis.__STYLE_LIFECYCLE_SCENE_REFS__ ?? []).filter((reference) => reference.deref()?.isActive); globalThis.__STYLE_LIFECYCLE_SCENE_REFS__.push(new WeakRef(scene));")
        .replace(sceneInspectSource, 'scenes: { readyCount: observedSceneReadyCount },')
        .replace(initialDashboardSource, 'const [showPrimary, setShowPrimary] = useState(!globalThis.__STYLE_LIFECYCLE_START_DORMANT__);')
        .replace(runtimeCatalogSource, `});
const originalPanelImporter = provider.panels.importPanelPlugin.bind(provider.panels);
let controlledPanelFailurePending = globalThis.__STYLE_LIFECYCLE_FAIL_FIRST_PANEL__;
provider.panels.importPanelPlugin = (id) => {
  if (controlledPanelFailurePending === id) {
    controlledPanelFailurePending = undefined;
    return Promise.reject(new Error('style-lifecycle.controlled-panel-load-failure'));
  }
  return originalPanelImporter(id);
};
const runtimePanelCatalog = Object.freeze({`)
        .replace(portalSource, 'let releasePortalRoot = () => undefined;')
        .replace(panelSource, "$1\n      globalThis.__STYLE_LIFECYCLE_INIT_EVENTS__?.push('datasource-query-and-panels-ready');\n      if (disposed) acquired.release();\n      else {\n        releasePortalRoot = acquireProviderPortalRoot();\n        globalThis.__STYLE_LIFECYCLE_INIT_EVENTS__?.push('portal-root-acquired');")
        .replace('markPortal();\n  }, []);', "markPortal();\n    globalThis.__STYLE_LIFECYCLE_INIT_EVENTS__?.push('dashboard-scene-ready');\n  }, []);");
    },
  };
}

export default defineConfig({
  ...(strictCspConfig as UserConfig),
  base: './',
  root: experimentRoot,
  build: {
    ...inheritedBuild,
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/style-lifecycle/provider'),
    rollupOptions: {
      ...inheritedRollup,
      input: { provider: resolve(experimentRoot, 'providerEntry.ts') },
      output: {
        ...inheritedOutput,
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: '[name].js',
      },
    },
  },
  plugins: [...(strictCspConfig.plugins ?? []), productionShapedLifecycleTransform()],
});
