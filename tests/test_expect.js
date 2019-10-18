import tap from 'tap';
import nock from 'nock';
import fetch from 'node-fetch';
import { fetchHelper } from '../src/index';

tap.test('test_expect', (tester) => {
  nock('http://httpbin.org')
    .get('/status/404')
    .reply(404);

  nock('http://httpbin.org')
    .get('/status/500')
    .reply(500, { bad: true });

  tester.test('Use expects', (test) => {
    const promise = fetchHelper({ fetch }, { url: 'http://httpbin.org/status/404', method: 'GET' });
    test.ok(promise.expect, 'Should have an expect method');
    promise.expect(404).then(({ status, body }) => {
      test.strictEquals(status, 404, 'Should catch the 404 when expected');
      test.ok(body, 'Should have a body on the error');
      test.end();
    }).catch(() => {
      test.notOk(true, 'Should not throw when expected');
      test.end();
    });
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

  tester.end();
});
