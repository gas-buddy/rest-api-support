import qs from 'query-string';
import type { FetchConfig, FetchRequest, FormDataOption } from './types/index';

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
    value: string | number | boolean | Buffer | Blob | File | Array<string | Buffer | Blob | File>,
    options?: FormDataOption | Array<FormDataOption>,
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

    // Helper function to handle appending a single item with metadata
    const appendItem = (
      itemName: string,
      item: any,
      itemOptions?: { filename?: string; contentType?: string },
    ) => {
      // No options case - simple append
      if (!itemOptions || (!itemOptions.filename && !itemOptions.contentType)) {
        p.body.append(itemName, item);
        return;
      }

      // For FormData API
      // If it's already a Blob or File, just use it with the provided filename
      if (item instanceof Blob || (typeof File !== 'undefined' && item instanceof File)) {
        p.body.append(itemName, item, itemOptions.filename);
        return;
      }
      // If both filename and contentType, create a Blob
      if (itemOptions.filename && itemOptions.contentType) {
        // Check if Blob is available
        if (typeof Blob !== 'undefined') {
          const blobOptions = { type: itemOptions.contentType };
          const blob = new Blob([item instanceof Buffer ? item : String(item)], blobOptions);
          p.body.append(itemName, blob, itemOptions.filename);
        } else {
          // Fallback for environments without Blob
          p.body.append(itemName, item);
        }
        return;
      }

      // Just filename case
      if (itemOptions.filename) {
        p.body.append(itemName, item, itemOptions.filename);
        return;
      }
      // Fallback - should not normally be reached
      p.body.append(itemName, item);
    };

    // For arrays, append each item individually with the same field name
    if (Array.isArray(value)) {
      // Check if options is also an array
      if (Array.isArray(options)) {
        // If options is an array, use corresponding option for each item
        value.forEach((item, index) => {
          const itemOptions = index < options.length ? options[index] : undefined;
          appendItem(name, item, itemOptions);
        });
      } else {
        // If options is not an array, use the same options for all items
        value.forEach((item) => appendItem(name, item, options));
      }
    } else {
      // For non-array values, options should not be an array
      appendItem(name, value, Array.isArray(options) ? options[0] : options);
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
