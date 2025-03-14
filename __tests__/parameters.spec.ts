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

  // Test with numeric path parameter
  const numParams = parameterBuilder('GET', 'http://restapi.com', '/pets/{pet_id}', config)
    .path('pet_id', 123)
    .build();

  expect(numParams.url).toEqual('http://restapi.com/pets/123');

  expect(params.url).toEqual('http://restapi.com/foo/ba%3D%23!%40%23z/bar?goodbye=123&goodbye=%25%23%24&hello=world');
  expect(params.body).toEqual(JSON.stringify(bodyArgs));
  expect(params.headers?.['content-type']).toEqual('application/json');
  expect(params.method).toEqual('POST'); // undefined
});

test('formData parameters', () => {
  // Spy on the FormData.append method
  const formDataAppendSpy = jest.spyOn(FormData.prototype, 'append');

  const config = { FormData } as unknown as FetchConfig;

  // Test with string value
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('filename', 'test.jpg')
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('filename', 'test.jpg');

  // Test with numeric value
  formDataAppendSpy.mockClear();
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('user_id', 12345)
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('user_id', 12345);

  // Test with Buffer value
  formDataAppendSpy.mockClear();
  const buffer = Buffer.from('test buffer data');
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('file_data', buffer)
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('file_data', buffer);

  // Test with Buffer array
  formDataAppendSpy.mockClear();
  const bufferArray = [Buffer.from('part1'), Buffer.from('part2')];
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('file_chunks', bufferArray)
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('file_chunks', JSON.stringify(bufferArray));

  // Test with string array
  formDataAppendSpy.mockClear();
  const stringArray = ['value1', 'value2'];
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('tags', stringArray)
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('tags', JSON.stringify(stringArray));

  // Clean up
  formDataAppendSpy.mockRestore();
});
