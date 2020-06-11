export interface AbortController {
  constructor(): this;
  abort(): void;
  signal: any;
}

export interface EventSource {
  constructor(url: string, init?: any): this;
  removeAllListeners(): this;
  addEventListener(name: string, handler: (data: any) => void): this;
  close(): this;
}

export interface ResponseHeaders {
  get(header: string) : any;
}

export interface FetchRequest {
  headers?: {[key: string]: string};
  body?: any;
  method: string;
  url: string;
  signal?: any;
}

export interface FetchResponse {
  // For expected response codes which are presented as valid responses even though they generated errors
  errObj?: Error,
  // Only for expected error cases and I'm not even sure why it returns this
  response?: FetchResponse;
  request: FetchRequest;
  headers?: ResponseHeaders;
  status: number;
  statusCode: number;
  body: any;
}

export interface InternalFetchResponse extends FetchResponse {
  // Tricky because it's not Buffer in the browser
  blob(): Promise<any>;
  json(): Promise<any>;
}

export interface FetchError extends Error {
  errno: string;
  status: number;
  statusCode: number;
  response: FetchResponse;
  // Hoisted from response for backwards compatibility
  body?: any;
  // Stored at call time
  originalStack: any;
  // Retry count
  retried?: number;
}

export interface FetchPerRequestOptions {
  /**
   * Run before the request goes out with the parameters that will be used
   */
  requestInterceptor?: (parameters: any, source?: string) => void;

  /**
   * Run after the request comes back
   */
  responseInterceptor?: (response: any, parameters: any, source?: string) => void;

  /**
   * Catch exceptions and just return error responses instead - this can help normalize error handling
   */
  noHttpExceptions?: boolean;

  shouldRetry?: (request: FetchRequest, error: Error) => boolean;

  onRetry?: (request: FetchRequest, error: Error) => void;

  /**
   * Default request timeout (msec)
   */
  timeout?: number,
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
   * For non-streaming requests
   */
  fetch: (url: string, init?: any) => Promise<FetchResponse>;

  /**
   * Run before the request goes out with the parameters that will be used
   */
  requestInterceptor?: (parameters: any, source?: string) => void;

  /**
   * Run after the request comes back
   */
  responseInterceptor?: (response: any, parameters: any, source?: string) => void;

  /**
   * Default request timeout (msec)
   */
  timeout?: number;

  onRetry?: (request: FetchRequest, error: Error) => void;
}
