import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  projectGrafana13ConstantVariableSet,
  projectGrafana13PluginSingleton,
  projectGrafana13SceneGraph,
  projectGrafana13RuntimeBarrel,
  projectGrafana13ViewOnlyVizPanel,
  projectGrafana13ViewOnlyVariableUtils,
} from './runtimeViewOnlyBarrelsPlugin';

describe('Grafana 13 runtime view-only barrel projection', () => {
  it('requires exact pinned identities for every projected package barrel', () => {
    const barrels = {
      data: 'node_modules/@grafana/data/dist/esm/index.mjs',
      i18n: 'node_modules/@grafana/i18n/dist/esm/index.mjs',
      runtime: 'node_modules/@grafana/runtime/dist/esm/index.mjs',
      scenes: 'node_modules/@grafana/scenes/dist/esm/index.js',
      ui: 'node_modules/@grafana/ui/dist/esm/index.mjs',
    } as const;
    for (const [barrel, file] of Object.entries(barrels)) {
      const source = readFileSync(resolve(file), 'utf8');
      expect(() => projectGrafana13RuntimeBarrel(barrel as keyof typeof barrels, `${source}\n`))
        .toThrow(/source identity/i);
    }
  });

  it('keeps only the audited Runtime exports needed by the Text scene', () => {
    const source = readFileSync(
      resolve('node_modules/@grafana/runtime/dist/esm/index.mjs'),
      'utf8'
    );

    const projected = projectGrafana13RuntimeBarrel('runtime', source);

    expect(projected).toContain("export { config }");
    expect(projected).not.toContain('GrafanaBootConfig');
    expect(projected).toContain('getPluginImportUtils');
    expect(projected).toContain('getBackendSrv');
    expect(projected).not.toContain('QueryEditorWithMigration');
    expect(projected).not.toContain("import './services/index.mjs'");
  });

  it('keeps namespace imports needed by audited data exports and rejects drift', () => {
    const source = readFileSync(resolve('node_modules/@grafana/data/dist/esm/index.mjs'), 'utf8');

    const projected = projectGrafana13RuntimeBarrel('data', source);
    expect(projected).toContain("import * as rangeutil from './datetime/rangeutil.mjs'");
    expect(projected).toContain('rangeutil as rangeUtil');
    expect(projected).toContain('EventBusSrv');
    expect(projected).not.toContain('monacoLanguageRegistry');

    expect(() => projectGrafana13RuntimeBarrel('runtime', 'export const unrelated = 1;'))
      .toThrow(/source identity/i);
    expect(() => projectGrafana13RuntimeBarrel('data', `${source}\n// changed`))
      .toThrow(/source identity/i);
  });

  it('removes the broad Scenes bootstrap and exposes only the exact scene primitives', () => {
    const source = readFileSync(resolve('node_modules/@grafana/scenes/dist/esm/index.js'), 'utf8');

    const projected = projectGrafana13RuntimeBarrel('scenes', source);
    expect(projected).toContain('SceneObjectBase');
    expect(projected).toContain('VizPanel');
    expect(projected).not.toContain('SceneApp');
    expect(projected).not.toContain('sceneUtils');
    expect(projected).not.toContain('registerRuntimePanelPlugin');
  });

  it('projects SceneVariableSet to the admitted constant-variable profile', () => {
    const source = readFileSync(
      resolve('node_modules/@grafana/scenes/dist/esm/variables/sets/SceneVariableSet.js'),
      'utf8'
    );
    const projected = projectGrafana13ConstantVariableSet(source);

    expect(projected).not.toContain("from '../adhoc/AdHocFiltersVariable.js'");
    expect(projected).not.toContain('instanceof AdHocFiltersVariable');
    expect(projected).toContain('} else if (localVar) {\n          return;\n        }');
    expect(() => projectGrafana13ConstantVariableSet('class SceneVariableSet {}'))
      .toThrow(/source identity/i);
    expect(() => projectGrafana13ConstantVariableSet(`${source}\n// changed`))
      .toThrow(/source identity/i);
  });

  it('projects sceneGraph away from unsupported scopes variables', () => {
    const source = readFileSync(
      resolve('node_modules/@grafana/scenes/dist/esm/core/sceneGraph/sceneGraph.js'),
      'utf8'
    );
    const projected = projectGrafana13SceneGraph(source);

    expect(projected).not.toContain("variables/variants/ScopesVariable.js");
    expect(projected).not.toContain('instanceof ScopesVariable');
    expect(projected).toContain('function getScopes(_sceneObject) {\n  return void 0;\n}');
    expect(() => projectGrafana13SceneGraph('function getScopes() {}'))
      .toThrow(/source identity/i);
    expect(() => projectGrafana13SceneGraph(`${source}\n// changed`))
      .toThrow(/source identity/i);
  });

  it('projects VizPanel away from query execution while preserving real plugin rendering', () => {
    const source = readFileSync(
      resolve('node_modules/@grafana/scenes/dist/esm/components/VizPanel/VizPanel.js'),
      'utf8'
    );
    const projected = projectGrafana13ViewOnlyVizPanel(source);

    expect(projected).toContain('class VizPanel extends SceneObjectBase');
    expect(projected).toContain('const panelPromise = importPanelPlugin(pluginId);');
    expect(projected).not.toContain("from '../../querying/");
    expect(projected).not.toContain('getQueryController');
    expect(projected).not.toContain('instanceof SceneQueryRunner');
    expect(projected).not.toContain('instanceof SceneDataTransformer');
    expect(() => projectGrafana13ViewOnlyVizPanel(`${source}\n// changed`))
      .toThrow(/source identity/i);
  });

  it('projects variable utilities away from the executable query-runner closure', () => {
    const source = readFileSync(
      resolve('node_modules/@grafana/scenes/dist/esm/variables/utils.js'),
      'utf8'
    );
    const projected = projectGrafana13ViewOnlyVariableUtils(source);

    expect(projected).toContain('function safeStringifyValue');
    expect(projected).toContain('safeStringifyValue');
    expect(projected).not.toContain("from '../querying/SceneQueryRunner.js'");
    expect(projected).not.toContain('function getQueriesForVariables');
    expect(projected).not.toContain('getQueriesForVariables,');
    expect(() => projectGrafana13ViewOnlyVariableUtils(`${source}\n// changed`))
      .toThrow(/source identity/i);
  });

  it('projects the pinned Runtime plugin singleton only at its exact source identity', () => {
    const source = readFileSync(
      resolve('node_modules/@grafana/runtime/dist/esm/utils/plugin.mjs'),
      'utf8'
    );
    const projected = projectGrafana13PluginSingleton(source);

    expect(projected).toContain('getPluginImportUtils');
    expect(projected).toContain('setPluginImportUtils');
    expect(projected).not.toContain('window.System.import');
    expect(() => projectGrafana13PluginSingleton(`${source}\n// changed`))
      .toThrow(/source identity/i);
  });
});
