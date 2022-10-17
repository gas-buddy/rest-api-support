import { autoRetry, retryCount } from './retry';
import { addTimeout } from './timeout';
import type {
  AbortController,
  CommonFetchResponse,
  FetchConfig,
  FetchError,
  FetchPerRequestOptions,
  FetchRequest,
  RestApiCallSource,
  RestApiSupportFetchResponse,
  SystemFetchResponse,
} from './types/index';

interface NodeErrorConstructor {
  captureStackTrace?(targetObject: Object, constructorOpt?: Function): void;
}

export function fetchHelper<T, R = any>(
  config: FetchConfig,
  request: FetchRequest,
  options?: FetchPerRequestOptions,
  source?: RestApiCallSource<R>,
): Promise<RestApiSupportFetchResponse<T>> {
  let promise = Promise.resolve();

  const placeholderError = new Error();
  if ((<NodeErrorConstructor>Error).captureStackTrace) {
    (<NodeErrorConstructor>Error).captureStackTrace!(placeholderError, fetchHelper);
  }

  const {
    fetch,
    AbortController,
    requestInterceptor,
    responseInterceptor,
    timeout: configTimeout,
  } = config;
  if (typeof requestInterceptor === 'function') {
    promise = promise.then(() => requestInterceptor(request, source));
  }
  if (options && typeof options.requestInterceptor === 'function') {
    promise = promise.then(() => options.requestInterceptor?.(request, source));
  }

  let timer: any;
  let abortController: AbortController | undefined;

  const responseHandler = (response: SystemFetchResponse) => {
    if (timer) {
      clearTimeout(timer);
    }

    const { headers, status } = response;
    const contentType = response.headers?.get('content-type')?.toLowerCase();

    const runAfterResponse = async (body: any) => {
      const result: RestApiSupportFetchResponse = {
        request,
        status,
        statusCode: status,
        headers,
        body,
        responseType: 'response',
      };
      if (typeof responseInterceptor === 'function') {
        await responseInterceptor(response, request, source, result);
      }
      if (options && typeof options.responseInterceptor === 'function') {
        await options.responseInterceptor(response, request, source, result);
      }
      if (!options?.noHttpExceptions && (status < 200 || status > 299)) {
        const error = new Error(result.body?.message || status) as FetchError;
        Object.assign(error, result, { responseType: 'error' });
        // Improve backwards compatibility
        if (!Object.hasOwnProperty.call(error, 'response')) {
          error.response = result as CommonFetchResponse;
        }
        throw error;
      }
      return result;
    };

    if (contentType?.includes('application/json')) {
      return response.json().then(runAfterResponse);
    }
    return response.blob().then(runAfterResponse);
  };
  const globalRetryFn: FetchConfig['shouldRetry'] = config.shouldRetry || autoRetry;
  const retryFn = options && typeof options.shouldRetry === 'function' ? options.shouldRetry : undefined;
  const expects = options?.expect || [];
  const errorHandler = async (error: FetchError): Promise<CommonFetchResponse> => {
    if (timer) {
      clearTimeout(timer);
    }
    if (expects.includes(error.statusCode)) {
      const simulatedResponse: RestApiSupportFetchResponse = {
        errObj: error,
        request,
        response: error.response,
        status: error.status,
        statusCode: error.statusCode,
        body: (error.response as any)?.body || error.body,
        responseType: 'response',
      };
      return simulatedResponse;
    }

    let willRetry = false;
    if (retryFn) {
      willRetry = await retryFn(request, error, config);
    } else {
      willRetry = await globalRetryFn(request, error, options);
    }
    if (willRetry) {
      const { onRetry } = options || {};
      if (typeof onRetry === 'function') {
        onRetry(request, error);
      }
      if (typeof config.onRetry === 'function') {
        config.onRetry(request, error);
      }
      const fetchRequest = { ...request };
      ({ timer, abortController } = addTimeout(
        fetchRequest,
        options,
        AbortController,
        options?.timeout || configTimeout,
      ));
      return fetch(request.url, fetchRequest).then(responseHandler).catch(errorHandler);
    }
    error.responseType = 'error';
    error.originalStack = placeholderError;
    if (retryCount(request)) {
      error.retried = retryCount(request);
    }
    throw error;
  };

  const finalPromise = promise
    .then(() => {
      const fetchRequest = { ...request };
      ({ timer, abortController } = addTimeout(
        fetchRequest,
        options,
        AbortController,
        options?.timeout || configTimeout,
      ));
      return fetch(request.url, fetchRequest);
    })
    .then(responseHandler)
    .catch(errorHandler);

  return Object.assign(finalPromise, {
    abort() {
      abortController!.abort();
    },
    isAborted() {
      return Boolean(abortController && abortController.signal.aborted);
    },
    expect(...codes: number[]): Promise<CommonFetchResponse> {
      expects.push(...codes);
      return this as unknown as Promise<CommonFetchResponse>;
    },
  }) as Promise<RestApiSupportFetchResponse<T>>;
}
