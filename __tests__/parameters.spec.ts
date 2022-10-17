import FormData from 'form-data';
import { FetchConfig } from '../src/index';
import { parameterBuilder } from '../src/parameters';

test('parameters', () => {
  const config = { FormData } as unknown as FetchConfig;
  let params = parameterBuilder('GET', 'http://restapi.com', '/foo/bar', config)
    .query('hello', 'world')
    .build();

  expect(params.url).toEqual('http://restapi.com/foo/bar?hello=world'); // undefined
  expect(params.method).toEqual('GET'); // undefined

  const bodyArgs = { key: 'value', json: ['always', 'works'] };
  params = parameterBuilder('POST', 'http://restapi.com', '/foo/{tag}/bar', config)
    .query('hello', 'world')
    .query('goodbye', ['123', '%#$'])
    .path('tag', 'ba=#!@#z')
    .body('req', bodyArgs)
    .build();

  expect(params.url).toEqual(
    'http://restapi.com/foo/ba%3D%23!%40%23z/bar?goodbye=123&goodbye=%25%23%24&hello=world'
  );
  expect(params.body).toEqual(JSON.stringify(bodyArgs));
  expect(params.headers?.['content-type']).toEqual('application/json');
  expect(params.method).toEqual('POST'); // undefined
});
