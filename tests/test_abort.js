import tap from 'tap';
import nock from 'nock';
import fetch from 'node-fetch';
import AbortController from 'abort-controller';
import { fetchHelper } from '../build/index';

tap.test('test_abort', (tester) => {
  nock('http://httpbin.org')
    .get('/status/200')
    .times(2)
    .delay(1000)
    .reply(200);

  tester.test('Signal works', async (test) => {
    const resultPromise = fetchHelper({ fetch, AbortController }, { url: 'http://httpbin.org/status/200', method: 'GET' }, {}, 'test');
    test.ok(!resultPromise.isAborted(), 'Should not be aborted');
    await new Promise(resolve => setTimeout(resolve, 100));
    test.ok(!resultPromise.isAborted(), 'Should not be aborted after delay');
    resultPromise.abort();
    test.ok(resultPromise.isAborted(), 'Should be aborted');
    await test.rejects(resultPromise, 'Should reject aborted call');
  });

  tester.test('Abort factory works', async (test) => {
    let count = 0;
    let abortController;
    const abortControllerFactory = () => { count += 1; abortController = new AbortController(); return abortController; };
    const promise = fetchHelper(
      { fetch, AbortController },
      { url: 'http://httpbin.org/status/200', method: 'GET' },
      { abortControllerFactory, timeout: 100 },
      'test',
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    test.equal(count, 1, 'Should have created an abort controller');
    test.notOk(abortController.signal.aborted, 'Should not be aborted');
    await test.rejects(promise, 'Should reject aborted call');
    test.ok(abortController.signal.aborted, 'Should be aborted');
  });

  tester.end();
});
