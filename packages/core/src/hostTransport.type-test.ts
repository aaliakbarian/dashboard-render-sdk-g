import type {
  HostTransportDescriptor,
  HostTransportExecutor,
} from '@dashboard-render-sdk-g/provider-contract';
import {
  createHostTransportCapability,
  type HostTransportCapabilityCreationResult,
} from './index';

type Assert<T extends true> = T;
type IsExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;

type ConstructorParameters = Parameters<typeof createHostTransportCapability>;
type ConstructorResult = ReturnType<typeof createHostTransportCapability>;
type _DescriptorParameter = Assert<IsExact<ConstructorParameters[0], HostTransportDescriptor>>;
type _ExecutorParameter = Assert<IsExact<ConstructorParameters[1], HostTransportExecutor>>;
type _ExactlyTwoParameters = Assert<IsExact<ConstructorParameters['length'], 2>>;
type _CreationResult = Assert<IsExact<ConstructorResult, HostTransportCapabilityCreationResult>>;

declare const result: HostTransportCapabilityCreationResult;
if (result.valid) {
  result.capability.execute;
  // @ts-expect-error Successful creation does not expose validation errors.
  result.errors;
  // @ts-expect-error Core does not issue a runtime-bound capability ID.
  result.capability.transportCapabilityId;
  // @ts-expect-error Capability creation is not runtime admission.
  result.capability.admit;
  // @ts-expect-error Capability creation does not construct RuntimeIdentity.
  result.capability.runtimeIdentity;
  // @ts-expect-error Core does not expose the host executor.
  result.capability.executor;
  // @ts-expect-error Core does not expose fetch.
  result.capability.fetch;
  // @ts-expect-error Core does not expose Grafana-specific BackendSrv.
  result.capability.backendSrv;
} else {
  result.errors;
  // @ts-expect-error Failed creation does not expose a capability.
  result.capability;
}

// @ts-expect-error Core deliberately does not re-export provider-contract transport types.
type CoreMustNotReexportTransportRequest = import('./index').TransportRequest;

type _CoreMustNotReexportTransportRequest = CoreMustNotReexportTransportRequest;
