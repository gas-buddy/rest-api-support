/* globals XMLHttpRequest */

interface EventSourceOptions {
  method?: string;
  body?: string;
  url: string;
  headers: { [key: string]: string };
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

interface EventSourceError {
  status: number;
  response: string;
}

interface Listeners {
  message: Array<(message: FullMessage) => void>;
  error: Array<(errorInfo: EventSourceError) => void>;
  close: Array<() => void>;
}

type GenericEvent = (...args: any[]) => void;
type EventName = 'message' | 'error' | 'close';

class ReactNativeEventSource {
  position = 0;

  isError = false;

  listeners: Listeners = {
    message: [],
    error: [],
    close: [],
  };

  message: MessageFragment = {
    data: [],
  };

  origin: string;

  options?: EventSourceOptions;

  xhr: XMLHttpRequest;

  constructor(url: string, options?: EventSourceOptions) {
    this.origin = url;
    this.options = options;
    this.xhr = this.retry();
  }

  retry() {
    const xhr = new XMLHttpRequest();
    xhr.open(this.options?.method || 'GET', this.origin, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.setRequestHeader('Cache-Control', 'no-cache'); // we must make use of this on the server side if we're working with Android - because they don't trigger
    if (this.options?.headers) {
      Object.keys(this.options.headers)
        .forEach((k) => xhr.setRequestHeader(k, this.options!.headers[k]));
    }
    xhr.onreadystatechange = () => this.onReadyStateChange(xhr);
    xhr.onerror = () => this.onError(xhr);
    xhr.send(this.options?.body || null);
    return xhr;
  }

  close() {
    this.xhr.abort();
  }

  addEventListener(event: EventName, callback: GenericEvent) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return this;
  }

  removeAllListeners() {
    this.listeners = { message: [], error: [], close: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeEventListener(event: EventName, listener: GenericEvent, options?: any) {
    if (this.listeners[event]) {
      this.listeners[event] = (this.listeners[event] as any[]).filter((cb: any) => cb !== listener);
    }
  }

  dataAvailable(text: string, isFinal: boolean) {
    if (this.isError) {
      if (!isFinal) {
        return;
      }
      this.listeners.error.forEach((cb) => cb({ status: this.xhr.status, response: text }));
      return;
    }

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
          this.listeners.message.forEach((cb) => cb(message));
        }
        this.message = { data: [] };
        this.position += 1;
      }
    }
  }

  onError(xhr: XMLHttpRequest) {
    this.listeners.error.forEach((cb) => cb({ status: xhr.status, response: xhr.responseText }));
  }

  onReadyStateChange(xhr: XMLHttpRequest) {
    switch (xhr.readyState) {
      case 3:
        this.dataAvailable(xhr.responseText, false);
        break;
      case 4:
        this.dataAvailable(xhr.responseText, true);
        this.listeners.close.forEach((cb) => cb());
        break;
      case 2:
        if (xhr.status < 200 || xhr.status > 299) {
          this.isError = true;
        }
        break;
      default:
        break;
    }
  }
}

export default ReactNativeEventSource;
