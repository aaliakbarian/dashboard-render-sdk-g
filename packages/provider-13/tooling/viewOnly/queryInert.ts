// These integrations cannot exist in the admitted constant-variable profile.
export class AdHocFiltersVariable { constructor() { throw new Error('Unsupported variable.'); } }
export class GroupByVariable { constructor() { throw new Error('Unsupported variable.'); } }
export class DrilldownDependenciesManager {
  readonly groupByVar = undefined;
  constructor(_dependency: unknown) {}
  findAndSubscribeToDrilldowns() {}
  isSubscribedAdHocFiltersVar() { return false; }
  getFilters() { return undefined; }
  getGroupByKeys() { return undefined; }
  cleanup() {}
}
