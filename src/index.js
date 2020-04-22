import qs from 'query-string';

const RETRY_COUNTER = Symbol('Retry counter for network errors');

async function autoRetry(request, error) {
  const count = request[RETRY_COUNTER] || 0;
  if (count < 3 && ['ECONNREFUSED', 'EAI_AGAIN'].includes(error.errno)) {
    await new Promise(accept => setTimeout(accept, [50, 100, 250][count]));
    request[RETRY_COUNTER] = count + 1;
    return true;
  }
  return false;
}

function addTimeout(request, AbortController, timeout) {
  if (!AbortController || !timeout) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  request.signal = controller.signal;
  return timer;
}

class ParameterBuilder {
  constructor(method, baseUrl, path, config) {
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
  path(name, value) {
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
  query(name, value) {
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
  body(_, json) {
    const p = this.parameters;
    p.headers = p.headers || {};
    if (!p.headers['content-type']) {
      p.headers['content-type'] = 'application/json';
    }
    p.body = JSON.stringify(json);
    return this;
  }

  formData(name, value) {
    const p = this.parameters;
    if (!p.body) {
      p.body = new this.config.FormData();
    }
    p.body.append(name, value);
    return this;
  }

  header(name, value) {
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
    const final = {
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

export function parameterBuilder(method, baseUrl, path, config, callOptions) {
  return new ParameterBuilder(method, baseUrl, path, config, callOptions);
}

export function fetchHelper(config, request, options, source) {
  let promise = Promise.resolve();

  const placeholderError = new Error();
  if (Error.captureStackTrace) {
    Error.captureStackTrace(placeholderError, fetchHelper);
  }

  const { fetch, AbortController, requestInterceptor, responseInterceptor, timeout: configTimeout } = config;
  if (typeof requestInterceptor === 'function') {
    promise = promise.then(() => config.requestInterceptor(request, source));
  }
  if (options && typeof options.requestInterceptor === 'function') {
    promise = promise.then(() => options.requestInterceptor(request, source));
  }

  let timer;
  const responseHandler = (response) => {
    if (timer) {
      clearTimeout(timer);
    }

    const { headers, status } = response;
    const contentType = response.headers.get('content-type')?.toLowerCase();

    const runAfterResponse = async (body) => {
      const result = { request, status, headers, body };
      if (typeof responseInterceptor === 'function') {
        await config.responseInterceptor(response, request, source);
      }
      if (options && typeof options.responseInterceptor === 'function') {
        await options.responseInterceptor(response, request, source);
      }
      if (!options?.noHttpExceptions && (status < 200 || status > 299)) {
        const error = new Error(result.body?.message || status);
        Object.assign(error, result);
        // Improve backwards compatibility
        if (!Object.hasOwnProperty.call(error, 'response')) {
          error.response = result;
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
  const retryFn = (options && typeof options.shouldRetry === 'function') ? options.shouldRetry : autoRetry;
  const errorHandler = async (error) => {
    if (timer) {
      clearTimeout(timer);
    }
    if (await retryFn(request, error)) {
      if (options && typeof options.onRetry === 'function') {
        options.onRetry(request, error);
      }
      if (typeof config.onRetry === 'function') {
        config.onRetry(request, error);
      }
      const fetchRequest = { ...request };
      timer = addTimeout(fetchRequest, AbortController, options?.timeout || configTimeout);
      return fetch(request.url, fetchRequest)
        .then(responseHandler)
        .catch(errorHandler);
    }
    error.originalStack = placeholderError;
    if (request[RETRY_COUNTER]) {
      error.retried = request[RETRY_COUNTER];
    }
    throw error;
  };

  promise = promise
    .then(() => {
      const fetchRequest = { ...request };
      timer = addTimeout(fetchRequest, AbortController, options?.timeout || configTimeout);
      return fetch(request.url, fetchRequest);
    })
    .then(responseHandler)
    .catch(errorHandler);

  return Object.assign(promise, {
    expect(...codes) {
      return this.catch((error) => {
        if (codes.includes(error.status)) {
          return {
            errObj: error,
            response: error.response,
            status: error.status,
            statusCode: error.statusCode,
            body: error.response?.body || error.body,
          };
        }
        throw error;
      });
    },
  });
}

export function eventSourceHelper(config, request, options, source) {
  const { EventSource, requestInterceptor } = config;
  if (typeof requestInterceptor === 'function') {
    config.requestInterceptor(request, source);
  }
  if (options && typeof options.requestInterceptor === 'function') {
    options.requestInterceptor(request, source);
  }
  return new EventSource(request.url, request);
}

export { default as ReactNativeEventSource } from './RNEventSource';
