import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function isExternalSpecifier(specifier) {
  return !(
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('./') ||
    specifier.startsWith('../')
  );
}

function stringLiteralValue(node) {
  return ts.isStringLiteralLike(node) ? node.text : undefined;
}

function scriptKindForFile(file) {
  if (/\.tsx$/i.test(file)) return ts.ScriptKind.TSX;
  if (/\.[cm]?jsx?$/i.test(file)) return ts.ScriptKind.JSX;
  return ts.ScriptKind.TS;
}

function sourcePragmas(sourceFile, name) {
  const pragma = sourceFile.pragmas.get(name);
  if (Array.isArray(pragma)) return pragma;
  return pragma ? [pragma] : [];
}

export function inspectSourceImports(sourceText, file = '<source>', jsxImportSource = 'react') {
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForFile(file)
  );
  const findings = [];

  const reportAt = (position, kind, specifier) => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
    findings.push({
      file,
      line: line + 1,
      column: character + 1,
      kind,
      specifier,
    });
  };

  const report = (node, kind, specifier) => {
    if (!isExternalSpecifier(specifier)) return;
    reportAt(node.getStart(sourceFile), kind, specifier);
  };

  for (const directive of sourceFile.typeReferenceDirectives) {
    reportAt(directive.pos, 'triple-slash-types', directive.fileName);
  }
  for (const directive of sourceFile.referencedFiles) {
    reportAt(directive.pos, 'triple-slash-path', directive.fileName);
  }
  for (const directive of sourceFile.libReferenceDirectives) {
    reportAt(directive.pos, 'triple-slash-lib', directive.fileName);
  }

  const jsxImportSourcePragmas = sourcePragmas(sourceFile, 'jsximportsource');
  let fileJsxImportSource;
  for (const pragma of jsxImportSourcePragmas) {
    const factory = pragma.arguments?.factory;
    if (typeof factory === 'string') fileJsxImportSource = factory;
    reportAt(
      pragma.range.pos,
      'jsx-import-source-pragma',
      typeof factory === 'string' ? `${factory}/jsx-runtime` : '<invalid-jsx-import-source>'
    );
  }
  for (const pragma of sourcePragmas(sourceFile, 'jsxruntime')) {
    if (pragma.arguments?.factory !== 'automatic') continue;
    reportAt(
      pragma.range.pos,
      'jsx-runtime-pragma',
      `${fileJsxImportSource ?? jsxImportSource}/jsx-runtime`
    );
  }

  let reportedJsx = false;

  const visit = (node) => {
    if (
      !reportedJsx &&
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))
    ) {
      reportAt(node.getStart(sourceFile), 'jsx-syntax', `${jsxImportSource}/jsx-runtime`);
      reportedJsx = true;
    }

    if (ts.isImportDeclaration(node)) {
      const specifier = stringLiteralValue(node.moduleSpecifier);
      if (specifier !== undefined) {
        report(
          node,
          node.importClause?.isTypeOnly ? 'import-type-declaration' : 'import',
          specifier
        );
      }
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const specifier = stringLiteralValue(node.moduleSpecifier);
      if (specifier !== undefined) {
        report(node, node.isTypeOnly ? 'type-re-export' : 're-export', specifier);
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      const specifier = stringLiteralValue(node.arguments[0]) ?? '<non-literal>';
      report(node, 'dynamic-import', specifier);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length > 0
    ) {
      const specifier = stringLiteralValue(node.arguments[0]) ?? '<non-literal>';
      report(node, 'commonjs-require', specifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const specifier = stringLiteralValue(node.argument.literal);
      if (specifier !== undefined) {
        report(node, 'typescript-import-type', specifier);
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression
    ) {
      const specifier = stringLiteralValue(node.moduleReference.expression);
      if (specifier !== undefined) {
        report(node, 'typescript-import-equals', specifier);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}

export function inspectDependencySections(manifest) {
  return DEPENDENCY_SECTIONS.flatMap((section) => {
    if (!Object.prototype.hasOwnProperty.call(manifest, section)) {
      return [];
    }

    const declared = manifest[section];
    const packages =
      declared && typeof declared === 'object' && !Array.isArray(declared)
        ? Object.keys(declared).sort()
        : [];
    return [{ section, packages }];
  });
}

function isInside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isTestLikeModule(file) {
  return /\.(?:test|type-test)\.(?:[cm]?ts|tsx)$/.test(file);
}

function sourceModuleReferences(sourceFile) {
  const references = [];
  const add = (node, specifier) => {
    if (specifier !== undefined) references.push({ node, specifier });
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      add(node, stringLiteralValue(node.moduleSpecifier));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add(node, stringLiteralValue(node.moduleSpecifier));
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0
    ) {
      add(node, stringLiteralValue(node.arguments[0]));
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length > 0
    ) {
      add(node, stringLiteralValue(node.arguments[0]));
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node, stringLiteralValue(node.argument.literal));
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression
    ) {
      add(node, stringLiteralValue(node.moduleReference.expression));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return references;
}

function resolveRelativeImports(sourceFile, file, packageRoot, compilerOptions) {
  const findings = [];
  const resolvedFiles = [];
  for (const { node, specifier } of sourceModuleReferences(sourceFile)) {
    if (isExternalSpecifier(specifier)) continue;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const base = {
      column: character + 1,
      file,
      line: line + 1,
      specifier,
    };
    const resolution = ts.resolveModuleName(specifier, sourceFile.fileName, compilerOptions, ts.sys);
    const resolvedFileName = resolution.resolvedModule?.resolvedFileName;
    if (!resolvedFileName) {
      findings.push({ ...base, kind: 'unresolved-relative-import' });
      continue;
    }
    const normalized = path.resolve(resolvedFileName);
    if (!isInside(packageRoot, normalized)) {
      findings.push({ ...base, kind: 'relative-import-outside-package' });
      continue;
    }

    if (isTestLikeModule(normalized)) {
      findings.push({ ...base, kind: 'production-imports-test-module' });
    }
    resolvedFiles.push(normalized);
  }
  return { findings, resolvedFiles };
}

function readProductionConfiguration(packageRoot) {
  const configPath = path.join(packageRoot, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(
      `Unable to read provider-contract production TypeScript configuration: ${ts.flattenDiagnosticMessageText(config.error.messageText, '\n')}`
    );
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, packageRoot, undefined, configPath);
  if (parsed.errors.length > 0) {
    throw new Error(
      `Invalid provider-contract production TypeScript configuration: ${parsed.errors
        .map(({ messageText }) => ts.flattenDiagnosticMessageText(messageText, '\n'))
        .join('; ')}`
    );
  }
  return {
    compilerOptions: parsed.options,
    rootFileNames: parsed.fileNames,
  };
}

export async function inspectProviderContractBoundary(repositoryRoot = process.cwd()) {
  const packageRoot = path.join(repositoryRoot, 'packages/provider-contract');
  const manifestPath = path.join(packageRoot, 'package.json');
  const tsconfigPath = path.join(packageRoot, 'tsconfig.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const dependencyFindings = inspectDependencySections(manifest).map((finding) => ({
    file: path.relative(repositoryRoot, manifestPath),
    ...finding,
  }));
  const importFindings = [];
  const { compilerOptions, rootFileNames } = readProductionConfiguration(packageRoot);
  if (compilerOptions.types === undefined || compilerOptions.types.length > 0) {
    dependencyFindings.push({
      file: path.relative(repositoryRoot, tsconfigPath),
      packages: compilerOptions.types ?? ['<implicit type acquisition>'],
      section: 'compilerOptions.types',
    });
  }
  if (
    compilerOptions.jsx === ts.JsxEmit.ReactJSX ||
    compilerOptions.jsx === ts.JsxEmit.ReactJSXDev
  ) {
    dependencyFindings.push({
      file: path.relative(repositoryRoot, tsconfigPath),
      packages: [
        `${compilerOptions.jsxImportSource ?? 'react'}/${
          compilerOptions.jsx === ts.JsxEmit.ReactJSXDev ? 'jsx-dev-runtime' : 'jsx-runtime'
        }`,
      ],
      section: 'compilerOptions.jsx',
    });
  }
  if (compilerOptions.jsxImportSource !== undefined) {
    dependencyFindings.push({
      file: path.relative(repositoryRoot, tsconfigPath),
      packages: [`${compilerOptions.jsxImportSource}/jsx-runtime`],
      section: 'compilerOptions.jsxImportSource',
    });
  }
  if (compilerOptions.importHelpers === true) {
    dependencyFindings.push({
      file: path.relative(repositoryRoot, tsconfigPath),
      packages: ['tslib'],
      section: 'compilerOptions.importHelpers',
    });
  }
  const jsxImportSource = compilerOptions.jsxImportSource ?? 'react';
  const pendingFiles = rootFileNames.map((fileName) => path.resolve(fileName)).sort();
  const visitedFiles = new Set();

  while (pendingFiles.length > 0) {
    const fileName = pendingFiles.shift();
    if (fileName === undefined || visitedFiles.has(fileName)) continue;
    visitedFiles.add(fileName);

    if (!isInside(packageRoot, fileName)) {
      importFindings.push({
        column: 1,
        file: path.relative(repositoryRoot, fileName),
        kind: 'production-root-outside-package',
        line: 1,
        specifier: fileName,
      });
      continue;
    }

    const sourceText = ts.sys.readFile(fileName);
    const file = path.relative(repositoryRoot, fileName);
    if (sourceText === undefined) {
      importFindings.push({
        column: 1,
        file,
        kind: 'unreadable-production-module',
        line: 1,
        specifier: fileName,
      });
      continue;
    }

    const sourceFile = ts.createSourceFile(
      fileName,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKindForFile(fileName)
    );
    importFindings.push(...inspectSourceImports(sourceFile.text, file, jsxImportSource));
    const resolution = resolveRelativeImports(
      sourceFile,
      file,
      packageRoot,
      compilerOptions
    );
    importFindings.push(...resolution.findings);
    pendingFiles.push(
      ...resolution.resolvedFiles.filter((resolvedFile) => !visitedFiles.has(resolvedFile))
    );
    pendingFiles.sort();
  }

  importFindings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.column - right.column ||
      left.kind.localeCompare(right.kind) ||
      left.specifier.localeCompare(right.specifier)
  );

  return { dependencyFindings, importFindings };
}

function formatFindings({ dependencyFindings, importFindings }) {
  return [
    ...dependencyFindings.map(({ file, section, packages }) => {
      const suffix = packages.length > 0 ? ` (${packages.join(', ')})` : '';
      return `${file}: forbidden ${section} section${suffix}`;
    }),
    ...importFindings.map(
      ({ file, line, column, kind, specifier }) =>
        `${file}:${line}:${column}: forbidden ${kind} from ${JSON.stringify(specifier)}`
    ),
  ];
}

async function main() {
  const findings = await inspectProviderContractBoundary();
  const diagnostics = formatFindings(findings);

  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      console.error(diagnostic);
    }
    process.exitCode = 1;
    return;
  }

  console.log('provider-contract boundary: clean');
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  await main();
}
