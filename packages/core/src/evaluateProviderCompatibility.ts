import {
  isExactVersion,
  type CompatibilityEvaluationCheck,
  type CompatibilityEvaluationCheckStatus,
  type CompatibilityEvaluationOutcome,
  type CompatibilityEvaluationResult,
  type CompatibilityObservations,
  type ExactVersionedDependency,
  type ManifestValidationSuccess,
  type TargetCompatibilityCell,
} from '@dashboard-render-sdk-g/provider-contract';

const MAX_ARRAY_LENGTH = 1_024;
const MAX_CONTAINER_PROPERTIES = 1_024;
const MAX_RETURNED_CHECKS = 100;

type ReflectionResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };
type ObservedString =
  | { readonly kind: 'missing' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'value'; readonly value: string };
type InspectedRecord = {
  readonly invalidKeys: ReadonlySet<string>;
  readonly valid: boolean;
  readonly values: Readonly<Record<string, unknown>>;
};
type DependencyInspection =
  | { readonly kind: 'invalid' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'value'; readonly values: ReadonlyMap<string, string> };

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const statusPrecedence = [
  'invalid-observation',
  'mismatch',
  'missing-evidence',
  'match',
] as const satisfies readonly CompatibilityEvaluationCheckStatus[];

function highestPrecedenceStatus(
  statuses: ReadonlySet<CompatibilityEvaluationCheckStatus>
): CompatibilityEvaluationCheckStatus {
  return statusPrecedence.find((status) => statuses.has(status)) ?? 'match';
}

function diagnosticLimitCheck(
  status: CompatibilityEvaluationCheckStatus
): CompatibilityEvaluationCheck {
  return {
    expected: 'at most 99 detailed checks',
    observed: 'additional diagnostics omitted',
    path: '$',
    status,
  };
}

function outcomeFor(
  statuses: ReadonlySet<CompatibilityEvaluationCheckStatus>
): CompatibilityEvaluationOutcome {
  const status = highestPrecedenceStatus(statuses);
  if (status === 'invalid-observation') return 'invalid-observations';
  if (status === 'mismatch') return 'mismatch';
  if (status === 'missing-evidence') return 'insufficient-evidence';
  return 'declared-requirements-match';
}

class BoundedChecks {
  readonly values: CompatibilityEvaluationCheck[] = [];
  readonly #statuses = new Set<CompatibilityEvaluationCheckStatus>();
  readonly #omittedStatuses = new Set<CompatibilityEvaluationCheckStatus>();
  #truncated = false;

  get outcome(): CompatibilityEvaluationOutcome {
    return outcomeFor(this.#statuses);
  }

  add(check: CompatibilityEvaluationCheck) {
    this.#statuses.add(check.status);
    if (this.#truncated) {
      this.#omittedStatuses.add(check.status);
      this.values[MAX_RETURNED_CHECKS - 1] = diagnosticLimitCheck(
        highestPrecedenceStatus(this.#omittedStatuses)
      );
      return;
    }
    if (this.values.length < MAX_RETURNED_CHECKS) {
      this.values.push(check);
      return;
    }
    this.#omittedStatuses.add(this.values[MAX_RETURNED_CHECKS - 1]!.status);
    this.#omittedStatuses.add(check.status);
    this.values[MAX_RETURNED_CHECKS - 1] = diagnosticLimitCheck(
      highestPrecedenceStatus(this.#omittedStatuses)
    );
    this.#truncated = true;
  }
}

function inspectReflection<T>(
  operation: () => T,
  path: string,
  diagnostics: BoundedChecks
): ReflectionResult<T> {
  try {
    return { ok: true, value: operation() };
  } catch {
    diagnostics.add({ path, status: 'invalid-observation' });
    return { ok: false };
  }
}

function inspectPlainRecord(
  value: unknown,
  path: string,
  allowedKeys: ReadonlySet<string>,
  diagnostics: BoundedChecks
): InspectedRecord | undefined {
  if (typeof value !== 'object' || value === null) {
    diagnostics.add({ path, status: 'invalid-observation' });
    return undefined;
  }
  const arrayResult = inspectReflection(() => Array.isArray(value), path, diagnostics);
  if (!arrayResult.ok) return undefined;
  if (arrayResult.value) {
    diagnostics.add({ path, status: 'invalid-observation' });
    return undefined;
  }
  const prototypeResult = inspectReflection(() => Object.getPrototypeOf(value), path, diagnostics);
  if (!prototypeResult.ok) return undefined;
  if (prototypeResult.value !== Object.prototype && prototypeResult.value !== null) {
    diagnostics.add({ path, status: 'invalid-observation' });
    return undefined;
  }
  const keysResult = inspectReflection(() => Reflect.ownKeys(value), path, diagnostics);
  if (!keysResult.ok) return undefined;
  if (keysResult.value.length > MAX_CONTAINER_PROPERTIES) {
    diagnostics.add({
      expected: `at most ${MAX_CONTAINER_PROPERTIES} own properties`,
      observed: `${keysResult.value.length} own properties`,
      path,
      status: 'invalid-observation',
    });
    return undefined;
  }

  const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  const invalidKeys = new Set<string>();
  let valid = true;
  for (const _symbol of keysResult.value.filter((key): key is symbol => typeof key === 'symbol')) {
    diagnostics.add({ path: `${path}[symbol]`, status: 'invalid-observation' });
    valid = false;
  }
  const stringKeys = keysResult.value
    .filter((key): key is string => typeof key === 'string')
    .sort(compareCodeUnits);
  for (const key of stringKeys) {
    const propertyPath = `${path}.${key}`;
    const descriptorResult = inspectReflection(
      () => Object.getOwnPropertyDescriptor(value, key),
      propertyPath,
      diagnostics
    );
    if (!descriptorResult.ok) {
      invalidKeys.add(key);
      valid = false;
      continue;
    }
    if (descriptorResult.value === undefined) {
      diagnostics.add({ path: propertyPath, status: 'invalid-observation' });
      invalidKeys.add(key);
      valid = false;
      continue;
    }
    const descriptor = descriptorResult.value;
    if (!allowedKeys.has(key)) {
      diagnostics.add({ path: propertyPath, status: 'invalid-observation' });
      valid = false;
      continue;
    }
    if (!descriptor.enumerable || !('value' in descriptor)) {
      invalidKeys.add(key);
      valid = false;
      continue;
    }
    values[key] = descriptor.value;
  }
  return { invalidKeys, valid, values };
}

function readString(
  record: InspectedRecord | undefined,
  key: string,
  exactVersion = false
): ObservedString {
  if (record?.invalidKeys.has(key)) return { kind: 'invalid' };
  const value = record?.values[key];
  if (value === undefined) return { kind: 'missing' };
  if (typeof value !== 'string' || value.trim().length === 0) return { kind: 'invalid' };
  if (exactVersion && !isExactVersion(value)) return { kind: 'invalid' };
  return { kind: 'value', value };
}

function addScalarCheck(
  checks: BoundedChecks,
  path: string,
  expected: string,
  observed: ObservedString
) {
  if (observed.kind === 'missing') {
    checks.add({ path, status: 'missing-evidence' });
    return;
  }
  if (observed.kind === 'invalid') {
    checks.add({ path, status: 'invalid-observation' });
    return;
  }
  checks.add({
    expected,
    observed: observed.value,
    path,
    status: observed.value === expected ? 'match' : 'mismatch',
  });
}

function inspectDependencyArray(value: unknown, diagnostics: BoundedChecks): DependencyInspection {
  if (value === undefined) return { kind: 'missing' };
  const path = '$.runtimeDependencies';
  const arrayResult = inspectReflection(() => Array.isArray(value), path, diagnostics);
  if (!arrayResult.ok) return { kind: 'invalid' };
  if (!arrayResult.value) {
    diagnostics.add({ path, status: 'invalid-observation' });
    return { kind: 'invalid' };
  }
  const arrayValue = value as readonly unknown[];

  const lengthResult = inspectReflection(
    () => Object.getOwnPropertyDescriptor(arrayValue, 'length'),
    path,
    diagnostics
  );
  if (!lengthResult.ok) return { kind: 'invalid' };
  const lengthDescriptor = lengthResult.value;
  if (
    lengthDescriptor === undefined ||
    !('value' in lengthDescriptor) ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    diagnostics.add({ path, status: 'invalid-observation' });
    return { kind: 'invalid' };
  }
  const length = lengthDescriptor.value;
  if (length > MAX_ARRAY_LENGTH) {
    diagnostics.add({
      expected: `at most ${MAX_ARRAY_LENGTH} entries`,
      observed: `${length} entries`,
      path,
      status: 'invalid-observation',
    });
    return { kind: 'invalid' };
  }

  const keysResult = inspectReflection(() => Reflect.ownKeys(arrayValue), path, diagnostics);
  if (!keysResult.ok) return { kind: 'invalid' };
  const elementKeys = keysResult.value.filter((key) => key !== 'length');
  if (elementKeys.length > MAX_CONTAINER_PROPERTIES) {
    diagnostics.add({
      expected: `at most ${MAX_CONTAINER_PROPERTIES} own properties`,
      observed: `${elementKeys.length} own properties`,
      path,
      status: 'invalid-observation',
    });
    return { kind: 'invalid' };
  }

  let valid = true;
  const indices = new Set<number>();
  for (const key of elementKeys) {
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)) {
      diagnostics.add({
        path: typeof key === 'symbol' ? `${path}[symbol]` : `${path}.${key}`,
        status: 'invalid-observation',
      });
      valid = false;
      continue;
    }
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index >= length) {
      diagnostics.add({ path: `${path}.${key}`, status: 'invalid-observation' });
      valid = false;
      continue;
    }
    indices.add(index);
  }
  if (indices.size !== length) {
    diagnostics.add({ path, status: 'invalid-observation' });
    return { kind: 'invalid' };
  }

  const observed = new Map<string, string>();
  for (let index = 0; index < length; index += 1) {
    const entryPath = `${path}[${index}]`;
    const descriptorResult = inspectReflection(
      () => Object.getOwnPropertyDescriptor(arrayValue, String(index)),
      entryPath,
      diagnostics
    );
    if (!descriptorResult.ok) {
      valid = false;
      continue;
    }
    if (descriptorResult.value === undefined) {
      diagnostics.add({ path: entryPath, status: 'invalid-observation' });
      valid = false;
      continue;
    }
    const descriptor = descriptorResult.value;
    if (!descriptor.enumerable || !('value' in descriptor)) {
      diagnostics.add({ path: entryPath, status: 'invalid-observation' });
      valid = false;
      continue;
    }
    const entry = inspectPlainRecord(
      descriptor.value,
      entryPath,
      new Set(['id', 'version']),
      diagnostics
    );
    if (entry === undefined) {
      valid = false;
      continue;
    }
    if (!entry.valid) valid = false;
    const id = readString(entry, 'id');
    const version = readString(entry, 'version', true);
    if (id.kind !== 'value') {
      diagnostics.add({ path: `${entryPath}.id`, status: 'invalid-observation' });
      valid = false;
    }
    if (version.kind !== 'value') {
      diagnostics.add({ path: `${entryPath}.version`, status: 'invalid-observation' });
      valid = false;
    }
    if (id.kind !== 'value' || version.kind !== 'value') continue;
    if (observed.has(id.value)) {
      diagnostics.add({
        observed: id.value,
        path: `${entryPath}.id`,
        status: 'invalid-observation',
      });
      valid = false;
      continue;
    }
    observed.set(id.value, version.value);
  }
  return valid ? { kind: 'value', values: observed } : { kind: 'invalid' };
}

function addDependencyChecks(
  checks: BoundedChecks,
  expectedDependencies: readonly ExactVersionedDependency[],
  observedDependencies: DependencyInspection
) {
  if (observedDependencies.kind === 'missing') {
    checks.add({ path: '$.runtimeDependencies', status: 'missing-evidence' });
    return;
  }
  if (observedDependencies.kind === 'invalid') return;

  const expected = new Map(expectedDependencies.map(({ id, version }) => [id, version]));
  const ids = [...new Set([...expected.keys(), ...observedDependencies.values.keys()])].sort(
    compareCodeUnits
  );
  for (const id of ids) {
    const expectedVersion = expected.get(id);
    const observedVersion = observedDependencies.values.get(id);
    checks.add({
      ...(expectedVersion === undefined ? {} : { expected: expectedVersion }),
      ...(observedVersion === undefined ? {} : { observed: observedVersion }),
      path: `$.runtimeDependencies[${JSON.stringify(id)}]`,
      status:
        expectedVersion !== undefined && observedVersion !== undefined && expectedVersion === observedVersion
          ? 'match'
          : 'mismatch',
    });
  }
}

function cloneTargetCell(cell: TargetCompatibilityCell): TargetCompatibilityCell {
  const source = Object.freeze({
    repository: cell.source.repository,
    revision: cell.source.revision,
    ...(cell.source.tag === undefined ? {} : { tag: cell.source.tag }),
  });
  return Object.freeze({ edition: cell.edition, source, version: cell.version });
}

function freezeResult(
  checks: BoundedChecks,
  matchedTargetCell: TargetCompatibilityCell | undefined
): CompatibilityEvaluationResult {
  for (const check of checks.values) Object.freeze(check);
  Object.freeze(checks.values);
  return Object.freeze({
    checks: checks.values,
    ...(matchedTargetCell === undefined ? {} : { matchedTargetCell }),
    outcome: checks.outcome,
  });
}

/**
 * Compares a canonical successful manifest inspection with explicit caller-supplied metadata.
 *
 * Equality is comparison evidence only: it is not runtime admission, does not
 * verify physical React object identity, and does not compare source provenance
 * with a running artifact build identity. This pure function performs no
 * provider access, network request, initialization, caching, or global mutation.
 * Required reflection can execute JavaScript Proxy traps; thrown reflection
 * failures are caught and represented without exposing thrown messages.
 */
export function evaluateProviderCompatibility(
  inspection: ManifestValidationSuccess,
  observations: CompatibilityObservations
): CompatibilityEvaluationResult {
  const diagnostics = new BoundedChecks();
  const root = inspectPlainRecord(
    observations,
    '$',
    new Set(['host', 'runtimeDependencies', 'target']),
    diagnostics
  );
  if (root === undefined) return freezeResult(diagnostics, undefined);

  const targetValue = root.values.target;
  const targetInvalid = root.invalidKeys.has('target');
  const target =
    targetValue === undefined || targetInvalid
      ? undefined
      : inspectPlainRecord(
          targetValue,
          '$.target',
          new Set(['edition', 'family', 'version']),
          diagnostics
        );
  const hostValue = root.values.host;
  const hostInvalid = root.invalidKeys.has('host');
  const host =
    hostValue === undefined || hostInvalid
      ? undefined
      : inspectPlainRecord(
          hostValue,
          '$.host',
          new Set(['reactDomVersion', 'reactVersion']),
          diagnostics
        );
  const dependenciesInvalid = root.invalidKeys.has('runtimeDependencies');
  const dependencyInspection = dependenciesInvalid
    ? ({ kind: 'invalid' } as const)
    : inspectDependencyArray(root.values.runtimeDependencies, diagnostics);

  const checks = new BoundedChecks();
  let matchedTargetCell: TargetCompatibilityCell | undefined;
  if (targetInvalid) {
    checks.add({ path: '$.target', status: 'invalid-observation' });
  } else if (targetValue !== undefined && target === undefined) {
    // The structural diagnostic already identifies the malformed group.
  } else {
    const family = readString(target, 'family');
    const version = readString(target, 'version', true);
    const edition = readString(target, 'edition');
    addScalarCheck(checks, '$.target.family', inspection.manifest.target.family, family);
    if (version.kind !== 'value' || edition.kind !== 'value') {
      if (version.kind !== 'value') {
        checks.add({
          path: '$.target.version',
          status: version.kind === 'missing' ? 'missing-evidence' : 'invalid-observation',
        });
      }
      if (edition.kind !== 'value') {
        checks.add({
          path: '$.target.edition',
          status: edition.kind === 'missing' ? 'missing-evidence' : 'invalid-observation',
        });
      }
    } else {
      const expected = inspection.manifest.target.cells
        .map((cell) => `${cell.edition}@${cell.version}`)
        .join(' | ');
      const observed = `${edition.value}@${version.value}`;
      const cell = inspection.manifest.target.cells.find(
        (candidate) => candidate.edition === edition.value && candidate.version === version.value
      );
      checks.add({ expected, observed, path: '$.target.cell', status: cell ? 'match' : 'mismatch' });
      if (cell && family.kind === 'value' && family.value === inspection.manifest.target.family) {
        matchedTargetCell = cloneTargetCell(cell);
      }
    }
  }

  if (hostInvalid) {
    checks.add({ path: '$.host', status: 'invalid-observation' });
  } else if (hostValue !== undefined && host === undefined) {
    // The structural diagnostic already identifies the malformed group.
  } else {
    addScalarCheck(
      checks,
      '$.host.reactVersion',
      inspection.manifest.host.reactVersion,
      readString(host, 'reactVersion', true)
    );
    addScalarCheck(
      checks,
      '$.host.reactDomVersion',
      inspection.manifest.host.reactDomVersion,
      readString(host, 'reactDomVersion', true)
    );
  }

  if (dependenciesInvalid) {
    checks.add({ path: '$.runtimeDependencies', status: 'invalid-observation' });
  } else {
    addDependencyChecks(checks, inspection.manifest.runtimeDependencies, dependencyInspection);
  }
  for (const diagnostic of diagnostics.values) checks.add(diagnostic);
  return freezeResult(checks, matchedTargetCell);
}
