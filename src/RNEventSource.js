/* globals XMLHttpRequest */
export default class ReactNativeEventSource {
  position = 0

  listeners = { message: [], error: [], close: [] }

  message = { data: [] }

  constructor(url, options) {
    const xhr = new XMLHttpRequest();
    this.origin = url;
    xhr.open(options.method || 'GET', options.url, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache'); // we must make use of this on the server side if we're working with Android - because they don't trigger
    if (options?.headers) {
      Object.keys(options.headers).forEach(k => xhr.setRequestHeader(k, options.headers[k]));
    }
    xhr.onreadystatechange = () => this.onReadyStateChange(xhr, options);
    xhr.onerror = () => this.onError(xhr);
    xhr.send(options.body || null);
  }

  addEventListener(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  removeAllListeners() {
    this.message = { message: [], error: [], end: [] };
  }

  dataAvailable(text) {
    const unparsed = text.substring(this.position);
    const lines = unparsed.split('\n');
    for (let i = 0, len = lines.length; i < len; i += 1) {
      const line = lines[i];

      if (line.indexOf('event') === 0) {
        this.message.eventType = line.replace(/event:?\s*/, '');
        if (i < len - 1) {
          this.position += line.length + 1;
        }
      } else if (line.indexOf('data') === 0) {
        if (i < len - 1) {
          this.position += line.length + 1;
          this.message.data.push(line.replace(/data:?\s*/, ''));
        }
      } else if (line.indexOf('id:') === 0) {
        if (i < len - 1) {
          this.position += line.length + 1;
        }
        this.message.id = line.replace(/id:?\s*/, '');
      } else if (line === '') {
        if (this.message.data.length) {
          const message = {
            data: JSON.parse(this.message.data.join('\n')),
            origin: this.origin,
            lastEventId: this.message.id,
          };
          this.listeners.message.forEach(cb => cb(message));
        }
        this.message = { data: [] };
        this.position += 1;
      }
    }
  }

  onError(xhr) {
    this.listeners.error.forEach(cb => cb(xhr.status, xhr.responseText));
  }

  onReadyStateChange(xhr) {
    switch (xhr.readyState) {
      case 3:
        this.dataAvailable(xhr.responseText);
        break;
      case 4:
        this.dataAvailable(xhr.responseText);
        break;
      case 2:
      default:
        break;
    }
  }
}
