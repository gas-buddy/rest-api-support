import tap from 'tap';
import nock from 'nock';
import fetch from 'node-fetch';
import { fetchHelper } from '../build/index';

tap.test('test_expect', (tester) => {
  nock('http://httpbin.org')
    .get('/status/404')
    .twice()
    .reply(404);

  nock('http://httpbin.org')
    .get('/status/500')
    .reply(500, { bad: true });

  tester.test('Use expects', async (test) => {
    const promise = fetchHelper({ fetch }, { url: 'http://httpbin.org/status/404', method: 'GET' });
    test.ok(promise.expect, 'Should have an expect method');
    await promise.expect(404).then(({ status, body }) => {
      test.equal(status, 404, 'Should catch the 404 when expected');
      test.ok(body, 'Should have a body on the error');
    }).catch(() => {
      test.notOk(true, 'Should not throw when expected');
    });

    const { status, body } = await fetchHelper({ fetch }, { url: 'http://httpbin.org/status/404', method: 'GET' }, { expect: [404] });
    test.equal(status, 404, 'Should catch the 404 when expected');
    test.ok(body, 'Should have a body on the error');
  });

  tester.test('Throw', (test) => {
    fetchHelper({ fetch }, { url: 'http://httpbin.org/status/500', method: 'GET' })
      .then(() => {
        test.notOk(true, 'Should not resolve promise for 500');
        test.end();
      })
      .catch(() => {
        test.ok(true, 'Should throw an error for 500');
        test.end();
      });
  });

  tester.test('Retry', (test) => {
    fetchHelper({ fetch }, { url: 'http://localhost:81/this-should-get-econnrefused', method: 'GET' })
      .then(() => {
        test.notOk(true, 'Should not complete');
        test.end();
      })
      .catch((error) => {
        test.equal(error.retried, 3, 'Should have retried 3 times');
        test.ok(true, 'Should eventually throw');
        test.end();
      });
  });

  tester.end();
});
