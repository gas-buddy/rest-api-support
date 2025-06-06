export interface AbortSignal {
  aborted: boolean;
}

export interface AbortController {
  abort(): void;
  signal: AbortSignal;
}

/**
 * Options for formData method to provide filename and content type
 */
export interface FormDataOption {
  filename?: string;
  contentType?: string;
}

export interface EventSource {
  removeAllListeners(): void;
  removeEventListener(name: string, handler: (data: any) => void, options?: any): void;
  addEventListener(name: string, handler: (data: any) => void): this;
  close(): void;
}

export interface ResponseHeaders {
  get(header: string): any;
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
  headers?: { [key: string]: string };
  body?: any;
  method: string;
  url: string;
  signal?: any;
}

export interface RestApiSupportFetchResponse<T = any> extends CommonFetchResponse {
  responseType: 'response';
  // For expected response codes which are presented as valid responses
  // even though they generated errors
  errObj?: Error;
  // Only for expected error cases and I'm not even sure why it returns this
  response?: CommonFetchResponse;
  request: FetchRequest;
  statusCode: number;
  body: T;
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
  responseType: 'error';
}

export interface RestApiErrorBody {
  code: string;
  message: string;
  domain: string;
  display_message?: string;
}

export interface RestApiSuccessResponse<T> extends CommonFetchResponse {
  responseType: 'response';
  body: T;
}

export interface RestApiResponse<S extends number, T> extends CommonFetchResponse {
  responseType: 'response' | 'error';
  status: S;
  body: T;
}

export interface RestApiCallSource<R = any> {
  method: string;
  client: string;
  arguments?: R;
}

export interface RestApiErrorResponse<S extends number = any>
  extends RestApiResponse<S, RestApiErrorBody> {
  responseType: 'error';
}

export interface FetchPerRequestOptions<R = any> {
  /**
   * Run before the request goes out with the parameters that will be used
   */
  requestInterceptor?: (
    parameters: FetchRequest,
    source?: RestApiCallSource<R>,
  ) => void | Promise<void>;

  /**
   * Run after the request comes back
   */
  responseInterceptor?: (
    response: any,
    parameters: any,
    source?: RestApiCallSource<R>,
    result?: RestApiSupportFetchResponse,
  ) => void | Promise<void>;

  /**
   * Catch exceptions and just return error responses instead -
   * this can help normalize error handling
   */
  noHttpExceptions?: boolean;

  /**
   * Whether a retry should be attempted for a particular request. The per-request
   * version of this is run BEFORE the globally configured one. If that per-request
   * shouldRetry exists, the globally configured one will not be called
   */
  shouldRetry?: (
    request: FetchRequest,
    error: Error,
    config: FetchConfig,
  ) => boolean | Promise<boolean>;

  onRetry?: (request: FetchRequest, error: Error) => void;

  /**
   * Default request timeout (msec)
   */
  timeout?: number;

  /**
   * Sometimes it's easier to pass your own AbortController so that you can
   * manage status and cancellation independent of our "promise infra." Since we may
   * automatically retry in certain cases, you need to be able to handle multiple calls
   * to this factory function per request, and return a new abort controller each time.
   */
  abortControllerFactory?: () => AbortController;

  /**
   * Non-200 responses in this list will NOT cause an error to be thrown.
   */
  expect?: number[];
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
  requestInterceptor?: (parameters: any, source?: RestApiCallSource<any>) => void | Promise<void>;

  /**
   * Run after the request comes back
   */
  responseInterceptor?: (
    response: any,
    parameters: any,
    source?: RestApiCallSource<any>,
    result?: RestApiSupportFetchResponse,
  ) => void | Promise<void>;

  /**
   * Default request timeout (msec)
   */
  timeout?: number;

  /**
   * Whether a retry should be attempted for a particular request. The per-request
   * version of this is run BEFORE the globally configured one. If that per-request
   * shouldRetry exists, the globally configured one will not be called
   */
  shouldRetry?: (
    request: FetchRequest,
    error: Error,
    options?: FetchPerRequestOptions,
  ) => boolean | Promise<boolean>;

  onRetry?: (request: FetchRequest, error: Error) => void;
}

export type ValidHTTPResponseCodes =
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 226
  | 300
  | 301
  | 302
  | 303
  | 304
  | 305
  | 307
  | 308
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 420
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 444
  | 449
  | 450
  | 451
  | 497
  | 498
  | 499
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 509
  | 510
  | 511
  | 521
  | 523
  | 525
  | 598
  | 599;

/**
 * @deprecated Pass in an AbortController factory and use it directly
 */
export interface ServiceCallAborter {
  abort(): void;
  isAborted(): boolean;
}

/**
 * @deprecated Do not use specialized promises anymore
 */
export interface ServiceCallPromise<T> extends Promise<T>, ServiceCallAborter {
  /**
   * Expect certain status codes and accept the promise rather than
   * throwing
   * @deprecated We now prefer that you pass expects: [...statusCodes] in the call options,
   * it keeps the Promise more pure.
   */
  expect(...statusCodes: number[]): ServiceCallPromise<T>;
}
