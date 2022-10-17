import qs from 'query-string';
import type { FetchConfig, FetchRequest } from './types/index';

class ParameterBuilder {
  parameters: { [key: string]: any };

  config: { [key: string]: any };

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
  query(name: string, value: string | string[]) {
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
  body(_: any, json: { [key: string]: any }) {
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

export function parameterBuilder(
  method: string,
  baseUrl: string,
  path: string,
  config: FetchConfig,
) {
  return new ParameterBuilder(method, baseUrl, path, config);
}
