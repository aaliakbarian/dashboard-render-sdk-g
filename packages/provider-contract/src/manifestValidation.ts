import {
  PROVIDER_MANIFEST_SCHEMA_VERSION,
  type ProviderCompatibilityManifest,
  type ProviderSupportTier,
} from './contracts';
import { isExactVersion } from './exactVersion';

export type ManifestValidationErrorCode =
  | 'non-serializable'
  | 'missing-field'
  | 'unknown-field'
  | 'invalid-field'
  | 'unsupported-manifest-version'
  | 'invalid-identifier'
  | 'duplicate-identifier'
  | 'invalid-exact-version'
  | 'invalid-dashboard-declaration'
  | 'invalid-capability';

export interface ManifestValidationError {
  readonly code: ManifestValidationErrorCode;
  readonly path: string;
  readonly message: string;
}

export interface ManifestValidationSuccess {
  readonly valid: true;
  readonly manifest: ProviderCompatibilityManifest;
}

export interface ManifestValidationFailure {
  readonly valid: false;
  readonly errors: readonly ManifestValidationError[];
}

export type ManifestValidationResult = ManifestValidationSuccess | ManifestValidationFailure;

type MutableValidationError = {
  code: ManifestValidationErrorCode;
  path: string;
  message: string;
};

type JsonCloneResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false };

type CloneState = {
  readonly ancestors: Set<object>;
  readonly errors: MutableValidationError[];
  aborted: boolean;
  visitedNodes: number;
};

type ReflectionResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

const supportTiers = new Set<ProviderSupportTier>(['experimental', 'verified', 'supported', 'deprecated']);
const identifierPattern = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]*$/;

// Provider manifests are small metadata records. These deliberately generous
// limits admit the verified provider-13 fixture while bounding hostile input.
const MAX_ARRAY_LENGTH = 1_024;
const MAX_CONTAINER_PROPERTIES = 1_024;
const MAX_TRAVERSAL_DEPTH = 32;
const MAX_VISITED_NODES = 4_096;
const MAX_VALIDATION_DIAGNOSTICS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function addError(
  errors: MutableValidationError[],
  code: ManifestValidationErrorCode,
  path: string,
  message: string
) {
  if (errors.length >= MAX_VALIDATION_DIAGNOSTICS) return;
  if (errors.length === MAX_VALIDATION_DIAGNOSTICS - 1) {
    errors.push({
      code: 'non-serializable',
      message: `Additional diagnostics were omitted after the ${MAX_VALIDATION_DIAGNOSTICS - 1} diagnostic limit.`,
      path,
    });
    return;
  }
  errors.push({ code, message, path });
}

function inspectReflection<T>(
  operation: () => T,
  path: string,
  errors: MutableValidationError[]
): ReflectionResult<T> {
  try {
    return { ok: true, value: operation() };
  } catch {
    addError(
      errors,
      'non-serializable',
      path,
      `${path} could not be inspected safely by the manifest validator.`
    );
    return { ok: false };
  }
}

function cloneJsonValue(
  value: unknown,
  path: string,
  depth: number,
  state: CloneState
): JsonCloneResult {
  if (depth > MAX_TRAVERSAL_DEPTH) {
    addError(
      state.errors,
      'non-serializable',
      path,
      `${path} exceeds the maximum traversal depth of ${MAX_TRAVERSAL_DEPTH}.`
    );
    state.aborted = true;
    return { ok: false };
  }
  state.visitedNodes += 1;
  if (state.visitedNodes > MAX_VISITED_NODES) {
    addError(
      state.errors,
      'non-serializable',
      path,
      `${path} exceeds the maximum visited-node count of ${MAX_VISITED_NODES}.`
    );
    state.aborted = true;
    return { ok: false };
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return { ok: true, value };
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return { ok: true, value };
    addError(state.errors, 'non-serializable', path, `${path} must contain a finite JSON number.`);
    return { ok: false };
  }
  if (typeof value !== 'object') {
    addError(state.errors, 'non-serializable', path, `${path} contains a value that JSON cannot represent.`);
    return { ok: false };
  }
  if (state.ancestors.has(value)) {
    addError(state.errors, 'non-serializable', path, `${path} contains a cyclic reference.`);
    return { ok: false };
  }

  const arrayInspection = inspectReflection(() => Array.isArray(value), path, state.errors);
  if (!arrayInspection.ok) return { ok: false };

  if (arrayInspection.value) {
    const keysInspection = inspectReflection(() => Reflect.ownKeys(value), path, state.errors);
    if (!keysInspection.ok) return { ok: false };
    const lengthInspection = inspectReflection(
      () => Object.getOwnPropertyDescriptor(value, 'length'),
      path,
      state.errors
    );
    if (!lengthInspection.ok) return { ok: false };
    const lengthDescriptor = lengthInspection.value;
    if (
      !lengthDescriptor ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      addError(state.errors, 'non-serializable', path, `${path} has an invalid array length descriptor.`);
      return { ok: false };
    }
    const length = lengthDescriptor.value;
    if (length > MAX_ARRAY_LENGTH) {
      addError(
        state.errors,
        'non-serializable',
        path,
        `${path} exceeds the maximum array length of ${MAX_ARRAY_LENGTH}.`
      );
      state.aborted = true;
      return { ok: false };
    }
    if (keysInspection.value.length - 1 > MAX_CONTAINER_PROPERTIES) {
      addError(
        state.errors,
        'non-serializable',
        path,
        `${path} exceeds the maximum array property count of ${MAX_CONTAINER_PROPERTIES}.`
      );
      state.aborted = true;
      return { ok: false };
    }

    let valid = true;
    const clone: unknown[] = [];
    const keys = keysInspection.value;
    if (keys.some((key) => typeof key === 'symbol')) {
      addError(state.errors, 'non-serializable', path, `${path} contains a symbol-keyed property.`);
      valid = false;
    }
    const indices: number[] = [];
    for (const key of keys) {
      if (typeof key !== 'string' || key === 'length') continue;
      if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length) {
        addError(state.errors, 'non-serializable', `${path}.${key}`, `${path}.${key} is not a JSON array element.`);
        valid = false;
      } else {
        indices.push(Number(key));
      }
    }
    indices.sort((left, right) => left - right);
    const firstMissingIndex = indices.findIndex((index, expected) => index !== expected);
    if (firstMissingIndex !== -1 || indices.length !== length) {
      const missingIndex = firstMissingIndex === -1 ? indices.length : firstMissingIndex;
      const entryPath = `${path}[${missingIndex}]`;
      addError(state.errors, 'non-serializable', entryPath, `${entryPath} is a sparse array hole.`);
      return { ok: false };
    }

    state.ancestors.add(value);
    for (const index of indices) {
      const entryPath = `${path}[${index}]`;
      const descriptorInspection = inspectReflection(
        () => Object.getOwnPropertyDescriptor(value, String(index)),
        entryPath,
        state.errors
      );
      if (!descriptorInspection.ok) {
        valid = false;
        if (state.errors.length >= MAX_VALIDATION_DIAGNOSTICS) break;
        continue;
      }
      const descriptor = descriptorInspection.value;
      if (!descriptor) {
        addError(state.errors, 'non-serializable', entryPath, `${entryPath} is a sparse array hole.`);
        valid = false;
        continue;
      }
      if (!descriptor.enumerable || !('value' in descriptor)) {
        addError(state.errors, 'non-serializable', entryPath, `${entryPath} must be an enumerable data property.`);
        valid = false;
        continue;
      }
      const nested = cloneJsonValue(descriptor.value, entryPath, depth + 1, state);
      if (nested.ok) clone[index] = nested.value;
      else valid = false;
      if (state.aborted) break;
    }
    state.ancestors.delete(value);
    return valid ? { ok: true, value: clone } : { ok: false };
  }

  const prototypeInspection = inspectReflection(() => Object.getPrototypeOf(value), path, state.errors);
  if (!prototypeInspection.ok) return { ok: false };
  const prototype = prototypeInspection.value;
  if (prototype !== Object.prototype && prototype !== null) {
    addError(state.errors, 'non-serializable', path, `${path} must be a plain JSON object.`);
    return { ok: false };
  }

  const keysInspection = inspectReflection(() => Reflect.ownKeys(value), path, state.errors);
  if (!keysInspection.ok) return { ok: false };
  if (keysInspection.value.length > MAX_CONTAINER_PROPERTIES) {
    addError(
      state.errors,
      'non-serializable',
      path,
      `${path} exceeds the maximum object property count of ${MAX_CONTAINER_PROPERTIES}.`
    );
    state.aborted = true;
    return { ok: false };
  }

  state.ancestors.add(value);
  let valid = true;
  const clone: Record<string, unknown> = {};
  const keys = keysInspection.value.sort((left, right) => String(left).localeCompare(String(right)));
  for (const key of keys) {
    if (typeof key === 'symbol') {
      addError(state.errors, 'non-serializable', path, `${path} contains a symbol-keyed property.`);
      valid = false;
      if (state.errors.length >= MAX_VALIDATION_DIAGNOSTICS) break;
      continue;
    }
    const propertyPath = path === '$' ? `$.${key}` : `${path}.${key}`;
    const descriptorInspection = inspectReflection(
      () => Object.getOwnPropertyDescriptor(value, key),
      propertyPath,
      state.errors
    );
    if (!descriptorInspection.ok) {
      valid = false;
      if (state.errors.length >= MAX_VALIDATION_DIAGNOSTICS) break;
      continue;
    }
    const descriptor = descriptorInspection.value;
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      addError(state.errors, 'non-serializable', propertyPath, `${propertyPath} must be an enumerable data property.`);
      valid = false;
      continue;
    }
    const nested = cloneJsonValue(descriptor.value, propertyPath, depth + 1, state);
    if (nested.ok) {
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: nested.value,
        writable: true,
      });
    } else {
      valid = false;
    }
    if (state.aborted) break;
  }
  state.ancestors.delete(value);
  return valid ? { ok: true, value: clone } : { ok: false };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function failure(errors: MutableValidationError[]): ManifestValidationFailure {
  return deepFreeze({ errors: [...errors], valid: false });
}

function validateObject(
  value: unknown,
  path: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  errors: MutableValidationError[]
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    addError(errors, 'invalid-field', path, `${path} must be an object.`);
    return undefined;
  }

  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) {
      addError(errors, 'missing-field', `${path}.${key}`, `${path}.${key} is required.`);
    }
  }

  const allowedKeys = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(value).sort()) {
    if (!allowedKeys.has(key)) {
      addError(errors, 'unknown-field', `${path}.${key}`, `${path}.${key} is not part of manifest schema v1.`);
    }
  }

  return value;
}

function validateIdentifier(value: unknown, path: string, errors: MutableValidationError[]): value is string {
  if (typeof value !== 'string') {
    addError(errors, 'invalid-field', path, `${path} must be a string identifier.`);
    return false;
  }
  if (!identifierPattern.test(value)) {
    addError(errors, 'invalid-identifier', path, `${path} must be a non-empty identifier without whitespace.`);
    return false;
  }
  return true;
}

function validateNonEmptyString(value: unknown, path: string, errors: MutableValidationError[]): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    addError(errors, 'invalid-field', path, `${path} must be a non-empty string.`);
    return false;
  }
  return true;
}

function validateExactVersion(value: unknown, path: string, errors: MutableValidationError[]): value is string {
  if (typeof value !== 'string') {
    addError(errors, 'invalid-field', path, `${path} must be an exact semantic version string.`);
    return false;
  }
  if (!isExactVersion(value)) {
    addError(errors, 'invalid-exact-version', path, `${path} must be an exact semantic version, not a range.`);
    return false;
  }
  return true;
}

function validateIdentifierArray(
  value: unknown,
  path: string,
  errors: MutableValidationError[]
): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    addError(errors, 'invalid-field', path, `${path} must be an array of identifiers.`);
    return undefined;
  }

  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!validateIdentifier(entry, entryPath, errors)) return;
    if (seen.has(entry)) {
      addError(errors, 'duplicate-identifier', entryPath, `${entryPath} duplicates identifier "${entry}".`);
    }
    seen.add(entry);
  });

  return value as readonly string[];
}

function validateProvider(value: unknown, errors: MutableValidationError[]) {
  const provider = validateObject(value, '$.provider', ['id', 'version', 'buildId', 'supportTier'], [], errors);
  if (!provider) return;

  validateIdentifier(provider.id, '$.provider.id', errors);
  validateExactVersion(provider.version, '$.provider.version', errors);
  validateIdentifier(provider.buildId, '$.provider.buildId', errors);
  if (typeof provider.supportTier !== 'string' || !supportTiers.has(provider.supportTier as ProviderSupportTier)) {
    addError(
      errors,
      'invalid-field',
      '$.provider.supportTier',
      '$.provider.supportTier must be experimental, verified, supported, or deprecated.'
    );
  }
}

function validateSource(value: unknown, path: string, errors: MutableValidationError[]) {
  const source = validateObject(value, path, ['repository', 'revision'], ['tag'], errors);
  if (!source) return;
  validateNonEmptyString(source.repository, `${path}.repository`, errors);
  validateNonEmptyString(source.revision, `${path}.revision`, errors);
  if (source.tag !== undefined) validateNonEmptyString(source.tag, `${path}.tag`, errors);
}

function validateTarget(value: unknown, errors: MutableValidationError[]) {
  const target = validateObject(value, '$.target', ['family', 'cells'], [], errors);
  if (!target) return;
  validateIdentifier(target.family, '$.target.family', errors);
  if (!Array.isArray(target.cells)) {
    addError(errors, 'invalid-field', '$.target.cells', '$.target.cells must be a non-empty array.');
    return;
  }
  if (target.cells.length === 0) {
    addError(errors, 'invalid-field', '$.target.cells', '$.target.cells must contain at least one exact target cell.');
  }

  const seen = new Set<string>();
  target.cells.forEach((value, index) => {
    const path = `$.target.cells[${index}]`;
    const cell = validateObject(value, path, ['version', 'edition', 'source'], [], errors);
    if (!cell) return;
    const versionValid = validateExactVersion(cell.version, `${path}.version`, errors);
    const editionValid = validateIdentifier(cell.edition, `${path}.edition`, errors);
    validateSource(cell.source, `${path}.source`, errors);
    if (versionValid && editionValid) {
      const key = `${cell.edition}\u0000${cell.version}`;
      if (seen.has(key)) {
        addError(errors, 'duplicate-identifier', path, `${path} duplicates target cell ${cell.edition}/${cell.version}.`);
      }
      seen.add(key);
    }
  });
}

function validateProvenance(value: unknown, errors: MutableValidationError[]) {
  const provenance = validateObject(value, '$.provenance', ['recordId'], [], errors);
  if (provenance) validateIdentifier(provenance.recordId, '$.provenance.recordId', errors);
}

function validateRuntimeDependencies(value: unknown, errors: MutableValidationError[]) {
  if (!Array.isArray(value)) {
    addError(errors, 'invalid-field', '$.runtimeDependencies', '$.runtimeDependencies must be an array.');
    return;
  }

  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const path = `$.runtimeDependencies[${index}]`;
    const dependency = validateObject(entry, path, ['id', 'version'], [], errors);
    if (!dependency) return;
    const idValid = validateIdentifier(dependency.id, `${path}.id`, errors);
    validateExactVersion(dependency.version, `${path}.version`, errors);
    if (idValid) {
      if (seen.has(dependency.id as string)) {
        addError(errors, 'duplicate-identifier', `${path}.id`, `${path}.id duplicates dependency "${dependency.id}".`);
      }
      seen.add(dependency.id as string);
    }
  });
}

function validateHost(value: unknown, errors: MutableValidationError[]) {
  const host = validateObject(value, '$.host', ['reactVersion', 'reactDomVersion'], [], errors);
  if (!host) return;
  validateExactVersion(host.reactVersion, '$.host.reactVersion', errors);
  validateExactVersion(host.reactDomVersion, '$.host.reactDomVersion', errors);
}

function validateDashboardApis(value: unknown, errors: MutableValidationError[]) {
  const path = '$.dashboards.apis';
  if (!Array.isArray(value) || value.length === 0) {
    addError(errors, 'invalid-dashboard-declaration', path, `${path} must contain at least one API declaration.`);
    return;
  }
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    const api = validateObject(entry, entryPath, ['group', 'version'], [], errors);
    if (!api) return;
    const groupValid = validateIdentifier(api.group, `${entryPath}.group`, errors);
    const versionValid = validateIdentifier(api.version, `${entryPath}.version`, errors);
    if (groupValid && versionValid) {
      const key = `${api.group}\u0000${api.version}`;
      if (seen.has(key)) {
        addError(errors, 'duplicate-identifier', entryPath, `${entryPath} duplicates API ${api.group}/${api.version}.`);
      }
      seen.add(key);
    }
  });
}

function validateDashboardSchemas(value: unknown, errors: MutableValidationError[]) {
  const path = '$.dashboards.schemas';
  if (!Array.isArray(value) || value.length === 0) {
    addError(errors, 'invalid-dashboard-declaration', path, `${path} must contain at least one schema declaration.`);
    return;
  }
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    const schema = validateObject(entry, entryPath, ['family', 'schemaVersion'], [], errors);
    if (!schema) return;
    const familyValid = validateIdentifier(schema.family, `${entryPath}.family`, errors);
    const versionValid = Number.isSafeInteger(schema.schemaVersion) && (schema.schemaVersion as number) > 0;
    if (!versionValid) {
      addError(
        errors,
        'invalid-dashboard-declaration',
        `${entryPath}.schemaVersion`,
        `${entryPath}.schemaVersion must be a positive safe integer.`
      );
    }
    if (familyValid && versionValid) {
      const key = `${schema.family}\u0000${schema.schemaVersion}`;
      if (seen.has(key)) {
        addError(errors, 'duplicate-identifier', entryPath, `${entryPath} duplicates schema ${schema.family}/${schema.schemaVersion}.`);
      }
      seen.add(key);
    }
  });
}

function validateDashboards(value: unknown, errors: MutableValidationError[]) {
  const dashboards = validateObject(value, '$.dashboards', ['apis', 'schemas', 'lookup'], [], errors);
  if (!dashboards) return;
  validateDashboardApis(dashboards.apis, errors);
  validateDashboardSchemas(dashboards.schemas, errors);
  validateIdentifier(dashboards.lookup, '$.dashboards.lookup', errors);
}

function validateCapabilities(value: unknown, errors: MutableValidationError[]) {
  const capabilities = validateObject(value, '$.capabilities', ['panels', 'datasources', 'transformations'], [], errors);
  if (!capabilities) return;
  validateIdentifierArray(capabilities.panels, '$.capabilities.panels', errors);
  validateIdentifierArray(capabilities.datasources, '$.capabilities.datasources', errors);

  const transformations = validateObject(
    capabilities.transformations,
    '$.capabilities.transformations',
    ['ids', 'allowEmptyPipeline', 'maxChainLength'],
    [],
    errors
  );
  if (!transformations) return;

  const ids = validateIdentifierArray(transformations.ids, '$.capabilities.transformations.ids', errors);
  if (typeof transformations.allowEmptyPipeline !== 'boolean') {
    addError(
      errors,
      'invalid-capability',
      '$.capabilities.transformations.allowEmptyPipeline',
      '$.capabilities.transformations.allowEmptyPipeline must be boolean.'
    );
  }

  const maxChainLength = transformations.maxChainLength;
  if (!Number.isSafeInteger(maxChainLength) || (maxChainLength as number) < 0) {
    addError(
      errors,
      'invalid-capability',
      '$.capabilities.transformations.maxChainLength',
      '$.capabilities.transformations.maxChainLength must be a non-negative safe integer.'
    );
  } else if (ids) {
    if (ids.length === 0 && maxChainLength !== 0) {
      addError(
        errors,
        'invalid-capability',
        '$.capabilities.transformations.maxChainLength',
        'A provider with no transformations must declare maxChainLength 0.'
      );
    }
    if (ids.length > 0 && maxChainLength === 0) {
      addError(
        errors,
        'invalid-capability',
        '$.capabilities.transformations.maxChainLength',
        'A provider declaring transformations must allow a positive maximum chain length.'
      );
    }
  }
}

/**
 * Validates and detaches plain JSON-like metadata without invoking ordinary
 * accessors. JavaScript proxy traps may still execute during required
 * reflection; trap failures are sanitized into typed validation diagnostics.
 */
export function validateProviderCompatibilityManifest(input: unknown): ManifestValidationResult {
  const serializationErrors: MutableValidationError[] = [];
  const clonedInput = cloneJsonValue(input, '$', 0, {
    aborted: false,
    ancestors: new Set(),
    errors: serializationErrors,
    visitedNodes: 0,
  });
  if (!clonedInput.ok) return failure(serializationErrors);

  const errors: MutableValidationError[] = [];
  const manifest = validateObject(
    clonedInput.value,
    '$',
    [
      'schemaVersion',
      'provider',
      'target',
      'provenance',
      'runtimeDependencies',
      'host',
      'dashboards',
      'capabilities',
    ],
    [],
    errors
  );
  if (!manifest) return failure(errors);

  if (manifest.schemaVersion !== PROVIDER_MANIFEST_SCHEMA_VERSION) {
    if (typeof manifest.schemaVersion === 'number') {
      addError(
        errors,
        'unsupported-manifest-version',
        '$.schemaVersion',
        `Manifest schema version ${manifest.schemaVersion} is unsupported; expected ${PROVIDER_MANIFEST_SCHEMA_VERSION}.`
      );
    } else {
      addError(errors, 'invalid-field', '$.schemaVersion', '$.schemaVersion must be a number.');
    }
  }

  validateProvider(manifest.provider, errors);
  validateTarget(manifest.target, errors);
  validateProvenance(manifest.provenance, errors);
  validateRuntimeDependencies(manifest.runtimeDependencies, errors);
  validateHost(manifest.host, errors);
  validateDashboards(manifest.dashboards, errors);
  validateCapabilities(manifest.capabilities, errors);

  if (errors.length > 0) return failure(errors);
  return deepFreeze({ manifest: manifest as unknown as ProviderCompatibilityManifest, valid: true });
}
