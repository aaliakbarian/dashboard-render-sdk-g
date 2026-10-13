// POC / EXPERIMENT / NOT FOR PRODUCTION
// DataSourceWithBackend's published module imports the Runtime services barrel
// only for module evaluation. The provider runtime installs the exact services
// before loading TestData, so this isolated artifact does not re-import the
// unrelated Runtime registration/export surface.
export {};
