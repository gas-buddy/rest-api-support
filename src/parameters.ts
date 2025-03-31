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
   * @param {string|number|Array} value The non-encoded value to be placed in the URL
   */
  path(name: string, value?: string | number | Array<string>) {
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
  query(name: string, value?: string | number | boolean | string[]) {
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

  formData(
    name: string,
    value: string | number | boolean | Buffer | Blob | File | Array<string> | Array<Buffer>,
    options?: { filename?: string; contentType?: string },
  ) {
    const p = this.parameters;
    if (!p.body) {
      if (!this.config.FormData) {
        throw new Error(
          'FormData is not available. Please provide a FormData implementation in the config.',
        );
      }

      p.body = new this.config.FormData();
    }

    // For arrays, append each item individually with the same field name
    if (Array.isArray(value)) {
      value.forEach((item) => {
        p.body.append(name, item);
      });
    } else if (options && (options.filename || options.contentType)) {
      // Support for files with metadata (images, etc.)
      if (value instanceof Blob || (typeof File !== 'undefined' && value instanceof File)) {
        // If it's already a Blob or File, just use it with the provided filename
        p.body.append(name, value, options.filename);
      } else if (options.filename && options.contentType) {
        // For other types (Buffer, string, etc.), create a Blob with metadata
        const blobOptions = { type: options.contentType };
        const blob = new Blob([value instanceof Buffer ? value : String(value)], blobOptions);
        p.body.append(name, blob, options.filename);
      } else if (options.filename) {
        p.body.append(name, value, options.filename);
      } else {
        p.body.append(name, value);
      }
    } else {
      p.body.append(name, value);
    }

    return this;
  }

  header(name: string, value?: string) {
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

function parameterBuilder(
  method: string,
  baseUrl: string,
  path: string,
  config: FetchConfig,
) {
  return new ParameterBuilder(method, baseUrl, path, config);
}

export default parameterBuilder;
