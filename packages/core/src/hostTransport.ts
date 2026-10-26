import type {
  HostTransportCapability,
  HostTransportDescriptor,
  HostTransportExecutor,
  TransportRequest,
  TransportResult,
} from '@dashboard-render-sdk-g/provider-contract';
import {
  MAX_VALIDATION_DIAGNOSTICS,
  readNativeAbortSignal,
  validateAndNormalizeTransportRequest,
  validateAndNormalizeHostTransportResponse,
  validateHostTransportDescriptor,
  type HostTransportValidationError,
} from './hostTransportValidation';

export type HostTransportCapabilityCreationErrorCode =
  | 'invalid-descriptor'
  | 'invalid-executor';

export interface HostTransportCapabilityCreationError {
  readonly code: HostTransportCapabilityCreationErrorCode;
  readonly path: string;
  readonly message: string;
}

export type HostTransportCapabilityCreationResult =
  | {
      readonly valid: true;
      readonly capability: HostTransportCapability;
    }
  | {
      readonly valid: false;
      readonly errors: readonly HostTransportCapabilityCreationError[];
    };

function freezeErrors(
  errors: readonly (HostTransportValidationError | HostTransportCapabilityCreationError)[]
): readonly HostTransportCapabilityCreationError[] {
  return Object.freeze(errors.map((error) => Object.freeze({ ...error })));
}

function cancelled(requestId: string): TransportResult {
  return Object.freeze({ kind: 'cancelled', requestId });
}

function networkError(requestId: string): TransportResult {
  return Object.freeze({ kind: 'network-error', requestId });
}

function invalidResponse(requestId: string): TransportResult {
  return Object.freeze({ code: 'invalid-response', kind: 'policy-error', requestId });
}

function executeWithCancellation(
  executor: HostTransportExecutor,
  request: TransportRequest
): Promise<TransportResult> {
  const { requestId, signal } = request;
  if (readNativeAbortSignal(signal)) return Promise.resolve(cancelled(requestId));

  return new Promise<TransportResult>((resolve) => {
    let settled = false;
    let listenerRegistered = false;

    const removeListener = () => {
      if (!listenerRegistered) return;
      listenerRegistered = false;
      try {
        signal.removeEventListener('abort', onAbort);
      } catch {
        // A host/provider supplied signal may override EventTarget methods.
        // Cleanup failure cannot expose its cause or change a settled result.
      }
    };
    const settle = (result: TransportResult) => {
      if (settled) return;
      settled = true;
      removeListener();
      resolve(result);
    };
    const onAbort = () => settle(cancelled(requestId));

    listenerRegistered = true;
    try {
      signal.addEventListener('abort', onAbort, { once: true });
    } catch {
      settle(networkError(requestId));
      return;
    }
    if (settled || readNativeAbortSignal(signal)) {
      settle(cancelled(requestId));
      return;
    }

    let execution: Promise<unknown>;
    try {
      execution = Promise.resolve(executor(request));
    } catch {
      settle(readNativeAbortSignal(signal) ? cancelled(requestId) : networkError(requestId));
      return;
    }

    try {
      Promise.prototype.then.call(
        execution,
        (rawResponse) => {
          if (readNativeAbortSignal(signal)) {
            settle(cancelled(requestId));
            return;
          }
          const responseResult = validateAndNormalizeHostTransportResponse(rawResponse);
          settle(
            responseResult.valid
              ? Object.freeze({
                  kind: 'response',
                  requestId,
                  response: responseResult.response,
                })
              : invalidResponse(requestId)
          );
        },
        () => {
          settle(readNativeAbortSignal(signal) ? cancelled(requestId) : networkError(requestId));
        }
      );
    } catch {
      settle(readNativeAbortSignal(signal) ? cancelled(requestId) : networkError(requestId));
    }
  });
}

export function createHostTransportCapability(
  descriptor: HostTransportDescriptor,
  executor: HostTransportExecutor
): HostTransportCapabilityCreationResult {
  const descriptorResult = validateHostTransportDescriptor(descriptor);
  const errors: HostTransportCapabilityCreationError[] = descriptorResult.valid
    ? []
    : [...descriptorResult.errors];
  if (typeof executor !== 'function' && errors.length < MAX_VALIDATION_DIAGNOSTICS) {
    errors.push({
      code: 'invalid-executor',
      message: 'Host transport executor must be a function.',
      path: '$.executor',
    });
  }
  if (errors.length > 0 || !descriptorResult.valid || typeof executor !== 'function') {
    return Object.freeze({ errors: freezeErrors(errors), valid: false });
  }

  const capability: HostTransportCapability = Object.freeze({
    descriptor: descriptorResult.descriptor,
    execute: async (request: TransportRequest) => {
      const requestResult = validateAndNormalizeTransportRequest(
        request,
        descriptorResult.descriptor
      );
      if (!requestResult.valid) {
        return Object.freeze({
          code: requestResult.code,
          kind: 'policy-error' as const,
          ...(requestResult.requestId === undefined ? {} : { requestId: requestResult.requestId }),
        });
      }
      return executeWithCancellation(executor, requestResult.request);
    },
  });
  return Object.freeze({ capability, valid: true });
}
