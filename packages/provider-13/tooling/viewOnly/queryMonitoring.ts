// The standalone provider has no monitoring collector or raw logging channel.
// Keep the pinned logger registry contract, discarding all payloads at its sink.
export function logDebug(..._values: unknown[]) {}
export function logInfo(..._values: unknown[]) {}
export function logWarning(..._values: unknown[]) {}
export function logError(..._values: unknown[]) {}
export function logMeasurement(..._values: unknown[]) {}
const logger = Object.freeze({ logDebug, logInfo, logWarning, logError, logMeasurement });
export function createMonitoringLogger(..._values: unknown[]) { return logger; }
