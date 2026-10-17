// POC / EXPERIMENT / NOT FOR PRODUCTION
// Zod reads this realm-shared setting during module evaluation. It must run
// before the provider dependency graph is evaluated so strict CSP never sees
// Zod's otherwise-caught Function-constructor capability probe.
globalThis.__zod_globalConfig ??= {};
globalThis.__zod_globalConfig.jitless = true;
