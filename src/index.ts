import qs from 'query-string';

export interface AbortSignal {
  aborted: boolean;
}

export interface AbortController {
  abort(): void;
  signal: AbortSignal;
}

interface EventSourceOptions {
  method?: string;
  body?: string;
  url: string;
  headers: {[key: string]: string};
}

export interface EventSource {
  removeAllListeners(): this;
  addEventListener(name: string, handler: (data: any) => void): this;
  close(): this;
}

export interface ResponseHeaders {
  get(header: string) : any;
}

export interface CommonFetchResponse {
  status: number;
  headers?: ResponseHeaders;
}

export interface SystemFetchResponse extends CommonFetchResponse {
  // Tricky because it's not Buffer in the browser
  blob(): Promise<any>;
  json(): Promise<any>;
}

export interface FetchRequest {
  headers?: {[key: string]: string};
  body?: any;
  method: string;
  url: string;
  signal?: any;
}

export interface RestApiSupportFetchResponse extends CommonFetchResponse {
  // For expected response codes which are presented as valid responses even though they generated errors
  errObj?: Error,
  // Only for expected error cases and I'm not even sure why it returns this
  response?: CommonFetchResponse;
  request: FetchRequest;
  statusCode: number;
  body: any;
  responseType: 'response',
}

export interface FetchError extends Error {
  errno: string;
  status: number;
  statusCode: number;
  response: CommonFetchResponse;
  // Hoisted from response for backwards compatibility
  body?: any;
  // Stored at call time
  originalStack: any;
  // Retry count
  retried?: number;
  responseType: 'error',
}

export interface RestApiErrorBody {
  code: string;
  message: string;
  domain: string;
  // eslint-disable-next-line babel/camelcase
  display_message?: string;
}

export interface RestApiSuccessResponse<T> {
  responseType: 'response';
  status: number;
  headers: ResponseHeaders;
  body: T;
}

export interface RestApiErrorResponse {
  responseType: 'error';
  body?: RestApiErrorBody;
  status: number;
  headers: ResponseHeaders;
}

export interface FetchPerRequestOptions {
  /**
   * Run before the request goes out with the parameters that will be used
   */
  requestInterceptor?: (parameters: FetchRequest, source?: string) => void | Promise<void>;

  /**
   * Run after the request comes back
   */
  responseInterceptor?: (response: any, parameters: any, source?: string, result?: RestApiSupportFetchResponse) => void | Promise<void>;

  /**
   * Catch exceptions and just return error responses instead - this can help normalize error handling
   */
  noHttpExceptions?: boolean;

  /**
   * Whether a retry should be attempted for a particular request. The per-request
   * version of this is run BEFORE the globally configured one. If that per-request
   * shouldRetry exists, the globally configured one will not be called
   */
  shouldRetry?: (request: FetchRequest, error: Error, config: FetchConfig) => boolean | Promise<boolean>;

  onRetry?: (request: FetchRequest, error: Error) => void;

  /**
   * Default request timeout (msec)
   */
  timeout?: number,

  /**
   * Sometimes it's easier to pass your own AbortController so that you can
   * manage status and cancellation independent of our "promise infra." Since we may
   * automatically retry in certain cases, you need to be able to handle multiple calls
   * to this factory function per request, and return a new abort controller each time.
   */
  abortControllerFactory?: () => AbortController,
}

export interface FetchConfig {
   /**
   * Will be prepended to the path defined in the Swagger spec
   */
  baseUrl?: string;

  /**
   * For timeout support
   */
  AbortController: new () => AbortController;

  /**
   * For streaming requests
   */
  EventSource: new (url: string, init?: any) => EventSource;

  /**
   * For multipart (e.g. file uploads)
   */
  FormData: new () => FormData;

  /**
   * For non-streaming requests
   */
  fetch: (url: string, init?: any) => Promise<SystemFetchResponse>;

  /**
   * Run before the request goes out with the parameters that will be used
   */
  requestInterceptor?: (parameters: any, source?: string) => void | Promise<void>;

  /**
   * Run after the request comes back
   */
  responseInterceptor?: (response: any, parameters: any, source?: string, result?: RestApiSupportFetchResponse) => void | Promise<void>;

  /**
   * Default request timeout (msec)
   */
  timeout?: number;

  /**
   * Whether a retry should be attempted for a particular request. The per-request
   * version of this is run BEFORE the globally configured one. If that per-request
   * shouldRetry exists, the globally configured one will not be called
   */
  shouldRetry?: (request: FetchRequest, error: Error, options: FetchPerRequestOptions) => boolean | Promise<boolean>;

  onRetry?: (request: FetchRequest, error: Error) => void;
}

export interface ServiceCallAborter {
  abort(): void;
  isAborted(): boolean;
}

export interface ServiceCallPromise<T> extends Promise<T>, ServiceCallAborter {
  /**
   * Expect certain status codes and accept the promise rather than
   * throwing
   */
  expect(...statusCodes: number[]) : ServiceCallPromise<T>;
}

const RETRY_COUNTER = Symbol('Retry counter for network errors');

interface FetchRequestPlus extends FetchRequest {
  [RETRY_COUNTER]: number;
}

interface NodeErrorConstructor {
  captureStackTrace?(targetObject: Object, constructorOpt?: Function): void;
}

async function autoRetry(request: FetchRequest, error: FetchError) {
  const requestPlus = (request as FetchRequestPlus);
  const count = requestPlus[RETRY_COUNTER] || 0;
  if (count < 3 && ['ECONNREFUSED', 'EAI_AGAIN'].includes(error.errno)) {
    await new Promise(accept => setTimeout(accept, [50, 100, 250][count]));
    requestPlus[RETRY_COUNTER] = count + 1;
    return true;
  }
  return false;
}

function addTimeout(
  request: FetchRequest, options: FetchPerRequestOptions | undefined, AbortController: new () => AbortController, timeout?: number,
): { timer?: any, abortController?: AbortController } {
  if (!AbortController && !options?.abortControllerFactory) {
    return {};
  }
  const abortController = options?.abortControllerFactory ? options.abortControllerFactory() : new AbortController();
  const timer = timeout ? setTimeout(() => abortController.abort(), timeout) : undefined;
  request.signal = abortController.signal;
  return { timer, abortController };
}

class ParameterBuilder {
  parameters: {[key: string]: any};

  config: {[key: string]: any};

  constructor(method: string, baseUrl: string, path: string, config: FetchConfig) {
    this.parameters = {
      method,
      url: `${baseUrl}${path}`,
    };
    this.config = config;
  }

  /**
   * Set a path parameter
   * @param {string} name The placeholder used in the URL
   * @param {string|Array} value The non-encoded value to be placed in the URL
   */
  path(name: string, value: string | Array<string>) {
    // TODO more full featured type conversion
    let urlValue = Array.isArray(value) ? value.join(',') : value;
    if (urlValue === undefined || urlValue === null) {
      urlValue = '';
    }
    const newUrl = this.parameters.url.replace(`{${name}}`, encodeURIComponent(urlValue));
    if (newUrl === this.parameters.url) {
      throw new Error(`Parameter ${name} is not a path parameter`);
    }
    this.parameters.url = newUrl;
    return this;
  }

  /**
   * Add a query parameter
   * @param {string} name
   * @param {string|Array} value
   */
  query(name: string, value: string) {
    if (typeof value !== 'undefined') {
      this.parameters.query = this.parameters.query || {};
      this.parameters.query[name] = value;
    }
    return this;
  }

  /**
   * Send a body parameter
   * @param {any} _ Unused for body arguments, but provided to be consistent with other methods
   * @param {*} json The object to be sent
   */
  body(_: void, json: {[key: string]: any}) {
    const p = this.parameters;
    p.headers = p.headers || {};
    if (!p.headers['content-type']) {
      p.headers['content-type'] = 'application/json';
    }
    p.body = JSON.stringify(json);
    return this;
  }

  formData(name: string, value: string) {
    const p = this.parameters;
    if (!p.body) {
      p.body = new this.config.FormData();
    }
    p.body.append(name, value);
    return this;
  }

  header(name: string, value: string) {
    if (typeof value !== 'undefined') {
      this.parameters.headers = this.parameters.headers || {};
      this.parameters.headers[name.toLowerCase()] = value;
    }
    return this;
  }

  /**
   * Return the parameter details object
   */
  build() {
    const final: FetchRequest = {
      url: this.parameters.url,
      method: this.parameters.method,
    };
    if (this.parameters.headers) {
      final.headers = this.parameters.headers;
    }
    if (this.parameters.body) {
      final.body = this.parameters.body;
    }
    if (this.parameters.query) {
      final.url = `${final.url}?${qs.stringify(this.parameters.query)}`;
    }
    return final;
  }
}

export function parameterBuilder(method: string, baseUrl: string, path: string, config: FetchConfig) {
  return new ParameterBuilder(method, baseUrl, path, config);
}

export function fetchHelper(
  config: FetchConfig, request: FetchRequest, options: FetchPerRequestOptions, source: string,
): ServiceCallPromise<CommonFetchResponse> {
  let promise = Promise.resolve();

  const placeholderError = new Error();
  if ((<NodeErrorConstructor> Error).captureStackTrace) {
    (<NodeErrorConstructor> Error).captureStackTrace!(placeholderError, fetchHelper);
  }

  const { fetch, AbortController, requestInterceptor, responseInterceptor, timeout: configTimeout } = config;
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
      const result: RestApiSupportFetchResponse = { request, status, statusCode: status, headers, body, responseType: 'response' };
      if (typeof responseInterceptor === 'function') {
        await responseInterceptor(response, request, source, result);
      }
      if (options && typeof options.responseInterceptor === 'function') {
        await options.responseInterceptor(response, request, source, result);
      }
      if (!options?.noHttpExceptions && (status < 200 || status > 299)) {
        const error: FetchError = <FetchError> new Error(result.body?.message || status);
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
  const globalRetryFn = config.shouldRetry || autoRetry;
  const retryFn = (options && typeof options.shouldRetry === 'function') ? options.shouldRetry : undefined;
  const errorHandler = async (error: FetchError): Promise<CommonFetchResponse> => {
    if (timer) {
      clearTimeout(timer);
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
      ({ timer, abortController } = addTimeout(fetchRequest, options, AbortController, options?.timeout || configTimeout));
      return fetch(request.url, fetchRequest)
        .then(responseHandler)
        .catch(errorHandler);
    }
    error.responseType = 'error';
    error.originalStack = placeholderError;
    if ((<FetchRequestPlus>request)[RETRY_COUNTER]) {
      error.retried = (<FetchRequestPlus>request)[RETRY_COUNTER];
    }
    throw error;
  };

  const finalPromise = promise
    .then(() => {
      const fetchRequest = { ...request };
      ({ timer, abortController } = addTimeout(fetchRequest, options, AbortController, options?.timeout || configTimeout));
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
    expect(...codes: number[]) : ServiceCallPromise<CommonFetchResponse> {
      const fetchPromise = (<Promise<CommonFetchResponse>>(<unknown> this));
      return fetchPromise.catch((error: FetchError) => {
        if (codes.includes(error.status)) {
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
        throw error;
      }) as ServiceCallPromise<CommonFetchResponse>;
    },
  });
}

export function eventSourceHelper(config: FetchConfig, request: FetchRequest, options: FetchPerRequestOptions, source: string) {
  const { EventSource, requestInterceptor } = config;
  let promise = Promise.resolve();
  if (typeof requestInterceptor === 'function') {
    promise = promise.then(() => requestInterceptor(request, source));
  }
  if (options && typeof options.requestInterceptor === 'function') {
    promise = promise.then(() => options.requestInterceptor!(request, source));
  }
  return promise.then(() => new EventSource(request.url, request));
}

export { default as ReactNativeEventSource } from './RNEventSource';
