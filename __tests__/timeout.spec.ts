import fetch from 'node-fetch';
import nock from 'nock';
import { fetchHelper, FetchConfig } from '../src/index';

describe('test_timeout', () => {
  nock('http://httpbin.org').get('/timeout/1').delay({ head: 50 }).times(3).reply(200);
  nock('http://httpbin.org').get('/timeout/2').delay({ head: 50 }).reply(200);
  nock('http://httpbin.org').get('/timeout/2').reply(200);

  test('Timeout should work', async () => {
    const result = await fetchHelper(
      { fetch, AbortController } as unknown as FetchConfig,
      { url: 'http://httpbin.org/timeout/1', method: 'GET' },
      { timeout: 10 },
    ).catch((e) => e);
    expect(result instanceof Error).toBeTruthy(); // Should return an error
    expect(result.type).toEqual('aborted'); // Should be an abort error
  });

  test('Timeout from config should work', async () => {
    const result = await fetchHelper(
      { fetch, AbortController, timeout: 10 } as unknown as FetchConfig,
      { url: 'http://httpbin.org/timeout/1', method: 'GET' },
    ).catch((e) => e);
    expect(result instanceof Error).toBeTruthy(); // Should return an error
    expect(result.type).toEqual('aborted'); // Should be an abort error
  });

  test('Timeout should not trigger if response is quick enough', async () => {
    const result = await fetchHelper(
      { fetch, AbortController } as unknown as FetchConfig,
      { url: 'http://httpbin.org/timeout/1', method: 'GET' },
      { timeout: 100 },
    );
    expect(result.status).toEqual(200); // Should return 200 after a retry
  });

  test('Timeout should work with retry', async () => {
    let retryRequested = false;
    const result = await fetchHelper(
      { fetch, AbortController } as unknown as FetchConfig,
      { url: 'http://httpbin.org/timeout/2', method: 'GET' },
      {
        shouldRetry() {
          if (retryRequested) {
            return false;
          }
          retryRequested = true;
          return true;
        },
        timeout: 10,
      },
    );
    expect(result.status).toEqual(200); // Should return 200 after a retry
    expect(retryRequested).toBeTruthy(); // Should have requested a retry
  });
});
