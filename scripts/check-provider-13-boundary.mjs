import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { inspectProductionTypeScriptBoundary } from './check-provider-contract-boundary.mjs';

const PACKAGE_PATH = 'packages/provider-13';
const PROVIDER_CONTRACT_PACKAGE = '@dashboard-render-sdk-g/provider-contract';
const REQUIRED_RANGE = 'workspace:*';
const REQUIRED_DEPENDENCIES = {
  [PROVIDER_CONTRACT_PACKAGE]: REQUIRED_RANGE,
  '@emotion/css': '11.13.5',
  '@emotion/react': '11.14.0',
  '@grafana/data': '13.2.3',
  '@grafana/e2e-selectors': '13.2.3',
  '@grafana/i18n': '13.2.3',
  '@grafana/runtime': '13.2.3',
  '@grafana/scenes': '8.13.5',
  '@grafana/schema': '13.2.3',
  '@grafana/ui': '13.2.3',
  'dangerously-set-html-content': '1.1.1',
  'react-router-dom': '6.30.3',
  'react-use': '17.6.1',
  rxjs: '7.8.2',
  uplot: '1.6.32',
};
const REQUIRED_PEERS = { react: '19.2.8', 'react-dom': '19.2.8' };
const FORBIDDEN_SECTIONS = [
  'devDependencies',
  'peerDependenciesMeta',
  'optionalDependencies',
  'bundledDependencies',
  'bundleDependencies',
  'dependenciesMeta',
  'resolutions',
  'overrides',
  'pnpm',
];
const STATIC_IMPORT_KINDS = new Set([
  'import',
  'import-type-declaration',
  'typescript-import-type',
]);
const RELATIVE_STATIC_KINDS = new Set([
  ...STATIC_IMPORT_KINDS,
  're-export',
  'type-re-export',
]);

function isPlainRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelativeSpecifier(specifier) {
  return (
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('./') ||
    specifier.startsWith('../')
  );
}

function dependencyFinding(file, kind, pathName, message) {
  return { file, kind, message, path: pathName };
}

function inspectManifest(manifest, file) {
  const findings = [];
  const dependencies = manifest.dependencies;

  if (!isPlainRecord(dependencies)) {
    for (const [dependency, range] of Object.entries(REQUIRED_DEPENDENCIES)) {
      findings.push(dependencyFinding(
        file, 'missing-required-dependency', `dependencies.${dependency}`,
        `Provider-13 must declare ${dependency} at ${range}.`
      ));
    }
  } else {
    for (const [dependency, range] of Object.entries(REQUIRED_DEPENDENCIES)) {
      if (!Object.prototype.hasOwnProperty.call(dependencies, dependency)) {
        findings.push(dependencyFinding(
          file, 'missing-required-dependency', `dependencies.${dependency}`,
          `Provider-13 must declare ${dependency} at ${range}.`
        ));
      } else if (dependencies[dependency] !== range) {
        findings.push(dependencyFinding(
          file, 'invalid-dependency-range', `dependencies.${dependency}`,
          `${dependency} must use ${range}.`
        ));
      }
    }
    for (const dependency of Object.keys(dependencies).sort()) {
      if (Object.prototype.hasOwnProperty.call(REQUIRED_DEPENDENCIES, dependency)) continue;
      findings.push(
        dependencyFinding(
          file,
          'forbidden-dependency',
          `dependencies.${dependency}`,
          'Provider-13 dependency is outside the exact provider-owned cohort.'
        )
      );
    }
  }

  const peers = manifest.peerDependencies;
  if (!isPlainRecord(peers)) {
    for (const [peer, range] of Object.entries(REQUIRED_PEERS)) {
      findings.push(dependencyFinding(
        file, 'missing-required-peer', `peerDependencies.${peer}`,
        `Provider-13 must declare ${peer} at ${range}.`
      ));
    }
  } else {
    for (const [peer, range] of Object.entries(REQUIRED_PEERS)) {
      if (!Object.prototype.hasOwnProperty.call(peers, peer)) {
        findings.push(dependencyFinding(
          file, 'missing-required-peer', `peerDependencies.${peer}`,
          `Provider-13 must declare ${peer} at ${range}.`
        ));
      } else if (peers[peer] !== range) {
        findings.push(dependencyFinding(
          file, 'invalid-peer-range', `peerDependencies.${peer}`,
          `${peer} must use ${range}.`
        ));
      }
    }
    for (const peer of Object.keys(peers).sort()) {
      if (Object.prototype.hasOwnProperty.call(REQUIRED_PEERS, peer)) continue;
      findings.push(dependencyFinding(
        file, 'forbidden-peer', `peerDependencies.${peer}`,
        'Provider-13 peer dependency is outside the exact host-owned React boundary.'
      ));
    }
  }

  for (const section of FORBIDDEN_SECTIONS) {
    if (!Object.prototype.hasOwnProperty.call(manifest, section)) continue;
    findings.push(
      dependencyFinding(
        file,
        'forbidden-dependency-section',
        section,
        `Provider-13 package.json must not declare ${section}.`
      )
    );
  }
  return findings;
}

const EXACT_SOURCE_OWNERS = {
  catalog: `${PACKAGE_PATH}/src/panels/catalog.ts`,
  cohort: `${PACKAGE_PATH}/src/runtime/cohort.ts`,
  renderer: `${PACKAGE_PATH}/src/react/Grafana13DashboardRenderer.tsx`,
  textPlugin: `${PACKAGE_PATH}/src/panels/textPlugin.ts`,
};

function exceptionalReferenceKey({ file, kind, specifier }) {
  const normalizedFile = file.replaceAll('\\', '/');
  if (
    kind === 'dynamic-import' &&
    specifier === './textPlugin' &&
    normalizedFile === EXACT_SOURCE_OWNERS.catalog
  ) {
    return `${normalizedFile}|${kind}|${specifier}`;
  }
  if (
    kind === 'dynamic-import' &&
    specifier === '../runtime/implementation' &&
    normalizedFile === EXACT_SOURCE_OWNERS.renderer
  ) {
    return `${normalizedFile}|${kind}|${specifier}`;
  }
  if (
    (specifier === 'grafana-provider13-text-renderer' ||
      specifier === 'grafana-provider13-data-panel-plugin') &&
    kind === 'import' &&
    normalizedFile === EXACT_SOURCE_OWNERS.textPlugin
  ) {
    return `${normalizedFile}|${kind}|${specifier}`;
  }
  if (
    kind === 'dynamic-import' &&
    normalizedFile === EXACT_SOURCE_OWNERS.cohort &&
    new Set([
      '@grafana/data',
      '@grafana/i18n',
      '@grafana/runtime',
      '@grafana/scenes',
      '@grafana/ui',
    ]).has(specifier)
  ) {
    return `${normalizedFile}|${kind}|${specifier}`;
  }
  return undefined;
}

function isAllowedReference({ kind, specifier }) {
  if (isRelativeSpecifier(specifier)) return RELATIVE_STATIC_KINDS.has(kind);
  const allowedBare = new Set([
    ...Object.keys(REQUIRED_DEPENDENCIES),
    ...Object.keys(REQUIRED_PEERS),
    'react-dom/client',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
  ]);
  return allowedBare.has(specifier) && STATIC_IMPORT_KINDS.has(kind);
}

export async function inspectProvider13Boundary(repositoryRoot = process.cwd()) {
  const packageRoot = path.join(repositoryRoot, PACKAGE_PATH);
  const manifestPath = path.join(packageRoot, 'package.json');
  const relativeManifestPath = path.relative(repositoryRoot, manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const sourceFindings = inspectProductionTypeScriptBoundary(
    repositoryRoot,
    PACKAGE_PATH,
    { includeRelativeReferences: true }
  );
  const compilerFindings = sourceFindings.dependencyFindings.map(
    ({ file, packages, section }) =>
      dependencyFinding(
        file,
        'compiler-dependency',
        section,
        `Compiler configuration introduces ${packages.join(', ')}.`
      )
  );
  const exceptionalCounts = new Map();
  const importFindings = sourceFindings.importFindings.filter((finding) => {
    const key = exceptionalReferenceKey(finding);
    if (key !== undefined) {
      const count = (exceptionalCounts.get(key) ?? 0) + 1;
      exceptionalCounts.set(key, count);
      return count > 1;
    }
    return !isAllowedReference(finding);
  });
  return {
    dependencyFindings: [
      ...inspectManifest(manifest, relativeManifestPath),
      ...compilerFindings,
    ],
    importFindings,
  };
}

function formatFindings({ dependencyFindings, importFindings }) {
  return [
    ...dependencyFindings.map(
      ({ file, kind, message, path: pathName }) =>
        `${file}: ${kind} at ${pathName}: ${message}`
    ),
    ...importFindings.map(
      ({ file, line, column, kind, specifier }) =>
        `${file}:${line}:${column}: forbidden ${kind} from ${JSON.stringify(specifier)}`
    ),
  ];
}

async function main() {
  const diagnostics = formatFindings(await inspectProvider13Boundary());
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) console.error(diagnostic);
    process.exitCode = 1;
    return;
  }
  console.log('provider-13 boundary: clean');
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) await main();
