// POC / EXPERIMENT / NOT FOR PRODUCTION
if (!('window' in globalThis)) {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: globalThis });
}
