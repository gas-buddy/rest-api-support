/* globals XMLHttpRequest */

interface EventSourceOptions {
  method?: string;
  body?: string;
  url: string;
  headers: {[key: string]: string};
}

interface MessageFragment {
  data: Array<string>;
  id?: string;
  eventType?: string;
}

interface FullMessage {
  data: string;
  origin: string;
  lastEventId?: string;
}

interface Listeners {
  message: Array<(message: FullMessage) => void>;
  error: Array<(status: number, responseText: string) => void>;
  close: Array<() => void>;
}

export default class ReactNativeEventSource {
  position = 0

  listeners: Listeners = {
    message: [],
    error: [],
    close: [],
  }

  message: MessageFragment = {
    data: [],
  }

  origin: string;

  xhr: XMLHttpRequest;

  constructor(url: string, options?: EventSourceOptions) {
    const xhr = new XMLHttpRequest();
    this.origin = url;
    xhr.open(options?.method || 'GET', url, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache'); // we must make use of this on the server side if we're working with Android - because they don't trigger
    if (options?.headers) {
      Object.keys(options.headers).forEach(k => xhr.setRequestHeader(k, options.headers[k]));
    }
    xhr.onreadystatechange = () => this.onReadyStateChange(xhr);
    xhr.onerror = () => this.onError(xhr);
    xhr.send(options?.body || null);
    this.xhr = xhr;
  }

  close() {
    this.xhr.abort();
  }

  addEventListener(event: 'message' | 'error' | 'close', callback: () => void) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  removeAllListeners() {
    this.listeners = { message: [], error: [], close: [] };
  }

  dataAvailable(text: string) {
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

  onError(xhr: XMLHttpRequest) {
    this.listeners.error.forEach(cb => cb(xhr.status, xhr.responseText));
  }

  onReadyStateChange(xhr: XMLHttpRequest) {
    switch (xhr.readyState) {
      case 3:
        this.dataAvailable(xhr.responseText);
        break;
      case 4:
        this.dataAvailable(xhr.responseText);
        this.listeners.close.forEach(cb => cb());
        break;
      case 2:
      default:
        break;
    }
  }
}
