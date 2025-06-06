import type {
  FetchConfig,
  FetchPerRequestOptions,
  FetchRequest,
  RestApiCallSource,
} from './types/index';

function eventSourceHelper(
  config: FetchConfig,
  request: FetchRequest,
  options: FetchPerRequestOptions,
  source?: RestApiCallSource,
) {
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

export default eventSourceHelper;
