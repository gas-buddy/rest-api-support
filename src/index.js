import qs from 'query-string';

class ParameterBuilder {
  constructor(method, baseUrl, path) {
    this.parameters = {
      method,
      url: `${baseUrl}${path}`,
    };
  }

  /**
   * Set a path parameter
   * @param {string} name The placeholder used in the URL
   * @param {string|Array} value The non-encoded value to be placed in the URL
   */
  path(name, value) {
    // TODO more full featured type conversion
    const urlValue = Array.isArray(value) ? value.join(',') : value;
    const newUrl = this.parameters.url.replace(`{${name}}`, encodeURIComponent(urlValue || ''));
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
    this.parameters.query = this.parameters.query || {};
    this.parameters.query[name] = value;
    return this;
  }

  body(json) {
    const p = this.parameters;
    p.headers = p.headers || {};
    if (!p.headers['content-type']) {
      p.headers['content-type'] = 'application/json';
    }
    p.body = JSON.stringify(json);
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

export function parameterBuilder(method, baseUrl, path) {
  return new ParameterBuilder(method, baseUrl, path);
}

export function fetchHelper(fetcher, request, options) {
  const { fetch, requestInterceptor, responseInterceptor } = fetcher;
  if (typeof requestInterceptor === 'function') {
    fetcher.requestInterceptor(request);
  }
  if (options && typeof options.requestInterceptor === 'function') {
    options.requestInterceptor(request);
  }
  return fetch(request.url, request)
    .then((response) => {
      const { headers, status } = response;
      const contentType = response.headers.get('content-type').toLowerCase();

      const runAfterResponse = (body) => {
        const result = { request, status, headers, body };
        if (typeof responseInterceptor === 'function') {
          fetcher.responseInterceptor(response, request);
        }
        if (options && typeof options.responseInterceptor === 'function') {
          options.responseInterceptor(response, request);
        }
        return result;
      };

      if (contentType && contentType.includes('application/json')) {
        return response.json().then(runAfterResponse);
      }
      return response.blob().then(runAfterResponse);
    });
}
