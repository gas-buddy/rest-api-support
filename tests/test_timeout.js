import tap from 'tap';
import nock from 'nock';
import fetch from 'node-fetch';
import AbortController from 'abort-controller';
import { fetchHelper } from '../build/index';

tap.test('test_timeout', (tester) => {
  nock('http://httpbin.org').get('/timeout/1').delay({ head: 50 }).times(3)
    .reply(200);
  nock('http://httpbin.org').get('/timeout/2').delay({ head: 50 })
    .reply(200);
  nock('http://httpbin.org').get('/timeout/2')
    .reply(200);

  tester.test('Timeout should work', async (test) => {
    const result = await fetchHelper({ fetch, AbortController }, { url: 'http://httpbin.org/timeout/1', method: 'GET' }, { timeout: 10 })
      .catch(e => e);
    test.ok(result instanceof Error, 'Should return an error');
    test.strictEquals(result.type, 'aborted', 'Should be an abort error');
  });

  tester.test('Timeout from config should work', async (test) => {
    const result = await fetchHelper({ fetch, AbortController, timeout: 10 }, { url: 'http://httpbin.org/timeout/1', method: 'GET' })
      .catch(e => e);
    test.ok(result instanceof Error, 'Should return an error');
    test.strictEquals(result.type, 'aborted', 'Should be an abort error');
  });

  tester.test('Timeout should not trigger if response is quick enough', async (test) => {
    const result = await fetchHelper({ fetch, AbortController }, { url: 'http://httpbin.org/timeout/1', method: 'GET' }, { timeout: 100 });
    test.strictEquals(result.status, 200, 'Should return 200 after a retry');
  });

  tester.test('Timeout should work with retry', async (test) => {
    let retryRequested = false;
    const result = await fetchHelper({ fetch, AbortController }, { url: 'http://httpbin.org/timeout/2', method: 'GET' }, {
      shouldRetry() {
        if (retryRequested) {
          return false;
        }
        retryRequested = true;
        return true;
      },
      timeout: 10,
    });
    test.strictEquals(result.status, 200, 'Should return 200 after a retry');
    test.ok(retryRequested, 'Should have requested a retry');
  });

  tester.end();
});
