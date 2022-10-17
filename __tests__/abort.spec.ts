import fetch from 'node-fetch';
import AbortController from 'abort-controller';
import { fetchHelper, FetchConfig } from '../src/index';

const delay = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

describe('abort', () => {
  const mockedFetch = jest.fn<Promise<any>, Parameters<typeof fetch>>();
  jest.mock('node-fetch', () => mockedFetch);
  mockedFetch.mockImplementation(() => delay(800).then(() => ({ status: 200 })));

  test('Signal works', async () => {
    const resultPromise = fetchHelper(
      { fetch, AbortController } as unknown as FetchConfig,
      { url: 'http://httpbin.org/status/200', method: 'GET' },
      {},
      'test',
    );
    const deprecatedPromise = resultPromise as any;

    // Old way
    expect(deprecatedPromise.isAborted()).toBeFalsy(); // Should not be aborted
    await delay(100);
    expect(deprecatedPromise.isAborted()).toBeFalsy(); // Should not be aborted after delay
    deprecatedPromise.abort();
    expect(deprecatedPromise.isAborted()).toBeTruthy(); // Should be aborted
    await expect(() => resultPromise).rejects.toThrow();
  });

  test('Abort factory works', async () => {
    let count = 0;
    let abortController: AbortController | undefined;
    const abortControllerFactory = () => {
      count += 1;
      abortController = new AbortController();
      return abortController;
    };

    const promise = fetchHelper(
      { fetch, AbortController } as unknown as FetchConfig,
      { url: 'http://httpbin.org/status/200', method: 'GET' },
      { abortControllerFactory, timeout: 100 },
      'test',
    );
    await delay(50);
    expect(count).toEqual(1); // Should have created one abort controller
    expect(abortController?.signal.aborted).toBeFalsy(); // Should not be aborted
    abortController?.abort();
    expect(abortController?.signal.aborted).toBeTruthy(); // Should be aborted
    await expect(() => promise).rejects.toThrow();
  });
});
