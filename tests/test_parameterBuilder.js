import tap from 'tap';
import { parameterBuilder } from '../src/index';

tap.test('test_parameterBuilder', (tester) => {
  let params = parameterBuilder('GET', 'http://restapi.com', '/foo/bar')
    .query('hello', 'world')
    .build();

  tester.strictEquals(params.url, 'http://restapi.com/foo/bar?hello=world');
  tester.strictEquals(params.method, 'GET');

  const bodyArgs = { key: 'value', json: ['always', 'works'] };
  params = parameterBuilder('POST', 'http://restapi.com', '/foo/{tag}/bar')
    .query('hello', 'world')
    .query('goodbye', ['123', '%#$'])
    .path('tag', 'ba=#!@#z')
    .body('req', bodyArgs)
    .build();

  tester.strictEquals(params.url, 'http://restapi.com/foo/ba%3D%23!%40%23z/bar?goodbye=123&goodbye=%25%23%24&hello=world');
  tester.strictEquals(params.body, JSON.stringify(bodyArgs));
  tester.strictEquals(params.headers['content-type'], 'application/json');
  tester.strictEquals(params.method, 'POST');

  tester.end();
});
