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

  // Test with numeric query parameter
  const numQuery = parameterBuilder('GET', 'http://restapi.com', '/search', config)
    .query('limit', 50)
    .build();

  expect(numQuery.url).toEqual('http://restapi.com/search?limit=50');

  // Test with boolean query parameter
  const boolQuery = parameterBuilder('GET', 'http://restapi.com', '/items', config)
    .query('available', true)
    .build();

  expect(boolQuery.url).toEqual('http://restapi.com/items?available=true');

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

  // Test with boolean value
  formDataAppendSpy.mockClear();
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('is_public', true)
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('is_public', true);

  // Test with Buffer value and options (like image upload)
  formDataAppendSpy.mockClear();
  const imageBuffer = Buffer.from('fake image data');
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('image', imageBuffer, {
      filename: 'profile.jpg',
      contentType: 'image/jpeg',
    })
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('image', imageBuffer, {
    filename: 'profile.jpg',
    contentType: 'image/jpeg',
  });

  // Clean up
  formDataAppendSpy.mockRestore();
});

test('Node.js form-data headers - explicit constructor', () => {
  // Create a FormData instance with a mock getHeaders method
  const mockFormData = new FormData();
  const getHeadersSpy = jest.spyOn(mockFormData, 'getHeaders').mockImplementation(() => ({
    'content-type': 'multipart/form-data; boundary=NodeJsFormDataBoundary123',
  }));

  const mockFormDataConstructor = jest.fn().mockReturnValue(mockFormData);

  const config = {
    FormData: mockFormDataConstructor,
    AbortController: jest.fn(),
    EventSource: jest.fn(),
    fetch: jest.fn(),
  } as unknown as FetchConfig;

  // Test headers are applied from form-data
  const request = parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('file', Buffer.from('test file content'))
    .build();

  // Verify getHeaders was called
  expect(getHeadersSpy).toHaveBeenCalled();

  // Verify headers were correctly applied from form-data
  expect(request.headers).toHaveProperty('content-type', 'multipart/form-data; boundary=NodeJsFormDataBoundary123');

  // Cleanup
  getHeadersSpy.mockRestore();
});

