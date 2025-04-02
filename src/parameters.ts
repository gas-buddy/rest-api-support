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

  /**
   * Send a form URL encoded body
   *
   * @param {object} data The key-value pairs to be encoded as form data
   *        - If a value is undefined or null, the field will be skipped (optional field)
   */
  formUrlEncoded(data: { [key: string]: string | number | boolean | string[] | undefined | null }) {
    const p = this.parameters;
    p.headers = p.headers || {};
    p.headers['content-type'] = 'application/x-www-form-urlencoded';

    // Use URLSearchParams for standard-compliant encoding
    const params = new URLSearchParams();

    // Append each key-value pair, handling arrays and skipping undefined/null values
    Object.entries(data).forEach(([key, value]) => {
      // Skip undefined and null values (optional fields)
      if (value === undefined || value === null) {
        return;
      }

      if (Array.isArray(value)) {
        // Handle arrays by adding multiple entries with the same key
        value.forEach((item) => {
          // Skip undefined and null items within arrays
          if (item !== undefined && item !== null) {
            params.append(key, String(item));
          }
        });
      } else {
        params.append(key, String(value));
      }
    });

    p.body = params.toString();
    return this;
  }

  /**
   * Adds form data entries to a multipart/form-data request
   *
   * @param {string} name The field name to use in the form data
   * @param {*} value The field value(s) to send (can be string, number, boolean, Buffer, Blob,
   *        File, Array, undefined, or null)
   *        - Primitive values (string, number, boolean) will be converted to strings
   *        - Buffer objects are sent as binary data
   *        - Blob or File objects are sent directly
   *        - Arrays can contain any of the above types and create multiple entries
   *        - If value is undefined or null, the field will be skipped (optional field)
   * @param {FormDataOption|Array<FormDataOption>} options Optional metadata for the form data
   *        - filename: Sets the filename for a file upload (e.g., "image.jpg")
   *        - contentType: Sets the content type for the data (e.g., "image/jpeg")
   *        - For arrays, you can provide a single options object or an array of options
   */
  formData(
    name: string,
    value:
    | string
    | number
    | boolean
    | Buffer
    | Blob
    | File
    | Array<string | number | boolean | Buffer | Blob | File | null | undefined>
    | undefined
    | null,
    options?: FormDataOption | Array<FormDataOption>,
  ) {
    // Skip adding this field if value is undefined or null (optional field)
    if (value === undefined || value === null) {
      return this;
    }

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
      // Filter out null/undefined values from the array
      const filteredValues = value.filter((item) => item !== undefined && item !== null);
      // Check if options is also an array
      if (Array.isArray(options)) {
        // If options is an array, use corresponding option for each item
        // We need to maintain the original indexes for options matching
        value.forEach((item, index) => {
          if (item !== undefined && item !== null) {
            const itemOptions = index < options.length ? options[index] : undefined;
            appendItem(name, item, itemOptions);
          }
        });
      } else {
        // If options is not an array, use the same options for all items
        filteredValues.forEach((item) => appendItem(name, item, options));
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
