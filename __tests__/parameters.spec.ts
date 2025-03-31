import { FetchConfig, parameterBuilder } from '../src/index';

const { FormData } = global;

test('parameters', () => {
  const mockFormDataConstructor = jest.fn().mockReturnValue(new FormData());
  const config = { FormData: mockFormDataConstructor } as unknown as FetchConfig;
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
  const mockFormData = new FormData();
  const formDataAppendSpy = jest.spyOn(FormData.prototype, 'append');
  const mockFormDataConstructor = jest.fn().mockReturnValue(mockFormData);

  const config = { FormData: mockFormDataConstructor } as unknown as FetchConfig;

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

  expect(formDataAppendSpy).toHaveBeenCalledWith('file_chunks', bufferArray[0]);
  expect(formDataAppendSpy).toHaveBeenCalledWith('file_chunks', bufferArray[1]);

  // Test with string array
  formDataAppendSpy.mockClear();
  const stringArray = ['value1', 'value2'];
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('tags', stringArray)
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('tags', stringArray[0]);
  expect(formDataAppendSpy).toHaveBeenCalledWith('tags', stringArray[1]);

  // Test with boolean value
  formDataAppendSpy.mockClear();
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('is_public', true)
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('is_public', true);

  // Test with Buffer value and options (like image upload)
  formDataAppendSpy.mockClear();
  const imageBuffer = Buffer.from('fake image data');

  // Just test that append is called, we can't easily mock the Blob constructor
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('image', imageBuffer, {
      filename: 'profile.jpg',
      contentType: 'image/jpeg',
    })
    .build();

  // Verify FormData.append was called (we can't check the exact parameters
  // because it's creating a Blob internally)
  expect(formDataAppendSpy).toHaveBeenCalled();

  // Test with array of Blob objects
  formDataAppendSpy.mockClear();

  // Create actual Blob objects instead of mocks
  const mockBlob1 = new Blob(['image1 data'], { type: 'image/png' });
  const mockBlob2 = new Blob(['image2 data'], { type: 'image/jpeg' });

  const blobArray = [mockBlob1, mockBlob2];

  // Test with array of Blobs and a filename
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('images', blobArray, {
      filename: 'image_collection.zip',
    })
    .build();

  // Should append each Blob with the filename
  expect(formDataAppendSpy).toHaveBeenCalledWith('images', mockBlob1, 'image_collection.zip');
  expect(formDataAppendSpy).toHaveBeenCalledWith('images', mockBlob2, 'image_collection.zip');

  // Test with array of Buffers with metadata
  formDataAppendSpy.mockClear();
  const bufferImagesArray = [Buffer.from('image1 data'), Buffer.from('image2 data')];

  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('buffer_images', bufferImagesArray, {
      filename: 'buffer_images.zip',
      contentType: 'application/zip',
    })
    .build();

  // For Buffer arrays with metadata, each Buffer should be converted to a Blob
  // We can't easily test the exact Blob creation, so we just verify append was called twice
  expect(formDataAppendSpy).toHaveBeenCalledTimes(2);

  // Test with array of values with array of options
  formDataAppendSpy.mockClear();
  const mixedArray = ['text1', Buffer.from('buffer1')];
  const optionsArray = [
    { filename: 'text.txt', contentType: 'text/plain' },
    { filename: 'binary.dat', contentType: 'application/octet-stream' },
  ];

  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('mixed_data', mixedArray, optionsArray)
    .build();

  // Should have been called twice (once for each item)
  expect(formDataAppendSpy).toHaveBeenCalledTimes(2);

  // Clean up
  formDataAppendSpy.mockRestore();
});

test('Node.js built-in FormData with fetch', () => {
  const mockFormData = new FormData();
  const appendSpy = jest.spyOn(mockFormData, 'append');

  const mockFormDataConstructor = jest.fn().mockReturnValue(mockFormData);

  const config = {
    FormData: mockFormDataConstructor,
    AbortController: jest.fn(),
    EventSource: jest.fn(),
    fetch: jest.fn(),
  } as unknown as FetchConfig;

  // Test that FormData is properly created and used
  const fileContent = Buffer.from('test file content');
  const request = parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData('file', fileContent)
    .build();

  // Verify append was called with the correct parameters
  expect(appendSpy).toHaveBeenCalledWith('file', fileContent);

  // Verify the request body is set to the FormData instance
  expect(request.body).toBe(mockFormData);

  // Cleanup
  appendSpy.mockRestore();
});
