// The provider installs its services explicitly before constructing TestData.
// DataSourceWithBackend's side-effect-only services barrel would also evaluate
// unrelated plugin registration and application services.
export {};
