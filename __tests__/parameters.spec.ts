import { FetchConfig, parameterBuilder } from '../src/index';

const { FormData } = global;

test('parameters', () => {
  const mockFormDataConstructor = jest.fn().mockReturnValue(new FormData());
  const config = { FormData: mockFormDataConstructor } as unknown as FetchConfig;
  let params = parameterBuilder('GET', 'http://restapi.com', '/foo/bar', config)
    .query('hello', 'world')
    .build();

  expect(params.url).toEqual('http://restapi.com/foo/bar?hello=world');
  expect(params.method).toEqual('GET');

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
  expect(params.method).toEqual('POST');
});

test('formData parameters', () => {
  const mockFormData = new FormData();
  const formDataAppendSpy = jest.spyOn(FormData.prototype, 'append');
  const mockFormDataConstructor = jest.fn().mockReturnValue(mockFormData);

  const config = { FormData: mockFormDataConstructor } as unknown as FetchConfig;

  // Test with string value
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData({ filename: 'test.jpg' })
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('filename', 'test.jpg');

  // Test with numeric value
  formDataAppendSpy.mockClear();
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData({ user_id: 12345 })
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('user_id', 12345);

  // Test with Buffer value
  formDataAppendSpy.mockClear();
  const buffer = Buffer.from('test buffer data');
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData({ file_data: buffer })
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('file_data', buffer);

  // Test with Buffer array
  formDataAppendSpy.mockClear();
  const bufferArray = [Buffer.from('part1'), Buffer.from('part2')];
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData({ file_chunks: bufferArray })
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('file_chunks', bufferArray[0]);
  expect(formDataAppendSpy).toHaveBeenCalledWith('file_chunks', bufferArray[1]);

  // Test with string array
  formDataAppendSpy.mockClear();
  const stringArray = ['value1', 'value2'];
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData({ tags: stringArray })
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('tags', stringArray[0]);
  expect(formDataAppendSpy).toHaveBeenCalledWith('tags', stringArray[1]);

  // Test with boolean value
  formDataAppendSpy.mockClear();
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData({ is_public: true })
    .build();

  expect(formDataAppendSpy).toHaveBeenCalledWith('is_public', true);

  // Test with Buffer value and options (like image upload)
  formDataAppendSpy.mockClear();
  const imageBuffer = Buffer.from('fake image data');

  // Just test that append is called, we can't easily mock the Blob constructor
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData(
      { image: imageBuffer },
      { image: { filename: 'profile.jpg', contentType: 'image/jpeg' } },
    )
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
    .formData(
      { images: blobArray },
      { images: { filename: 'image_collection.zip' } },
    )
    .build();

  // Should append each Blob with the filename
  expect(formDataAppendSpy).toHaveBeenCalledWith('images', mockBlob1, 'image_collection.zip');
  expect(formDataAppendSpy).toHaveBeenCalledWith('images', mockBlob2, 'image_collection.zip');

  // Test with array of Buffers with metadata
  formDataAppendSpy.mockClear();
  const bufferImagesArray = [Buffer.from('image1 data'), Buffer.from('image2 data')];

  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData(
      { buffer_images: bufferImagesArray },
      { buffer_images: { filename: 'buffer_images.zip', contentType: 'application/zip' } },
    )
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
    .formData(
      { mixed_data: mixedArray },
      { mixed_data: optionsArray },
    )
    .build();

  // Should have been called twice (once for each item)
  expect(formDataAppendSpy).toHaveBeenCalledTimes(2);

  // Test with optional properties
  formDataAppendSpy.mockClear();
  parameterBuilder('POST', 'http://restapi.com', '/upload', config)
    .formData({
      requiredField: 'value',
      optionalField1: undefined,
      optionalField2: null,
      optionalArrayField: [Buffer.from('data1'), 'value2'] as Array<Buffer | string>,
    })
    .build();

  // Verify required field is added
  expect(formDataAppendSpy).toHaveBeenCalledWith('requiredField', 'value');

  // Verify optional fields with null/undefined values are skipped
  const optionalField1Calls = formDataAppendSpy.mock.calls.filter(
    (call) => call[0] === 'optionalField1',
  );
  expect(optionalField1Calls.length).toBe(0);

  const optionalField2Calls = formDataAppendSpy.mock.calls.filter(
    (call) => call[0] === 'optionalField2',
  );
  expect(optionalField2Calls.length).toBe(0);

  // Verify array with null/undefined items
  const optionalArrayCalls = formDataAppendSpy.mock.calls.filter(
    (call) => call[0] === 'optionalArrayField',
  );
  expect(optionalArrayCalls.length).toBe(2); // Only 2 valid items should be appended

  // Clean up
  formDataAppendSpy.mockRestore();
});

test('formData with complex object', () => {
  const mockFormData = new FormData();
  const formDataAppendSpy = jest.spyOn(FormData.prototype, 'append');
  const mockFormDataConstructor = jest.fn().mockReturnValue(mockFormData);

  const config = { FormData: mockFormDataConstructor } as unknown as FetchConfig;

  // Test with a complex object
  const complexObject = {
    name: 'Test User',
    age: 30,
    isActive: true,
    profileImage: Buffer.from('fake image data'),
    tags: ['tag1', 'tag2'],
    nullField: null,
    undefinedField: undefined,
  };

  parameterBuilder('POST', 'http://restapi.com', '/user', config)
    .formData(complexObject)
    .build();

  // Verify all non-null/undefined fields were appended
  expect(formDataAppendSpy).toHaveBeenCalledWith('name', 'Test User');
  expect(formDataAppendSpy).toHaveBeenCalledWith('age', 30);
  expect(formDataAppendSpy).toHaveBeenCalledWith('isActive', true);
  expect(formDataAppendSpy).toHaveBeenCalledWith('profileImage', complexObject.profileImage);
  expect(formDataAppendSpy).toHaveBeenCalledWith('tags', 'tag1');
  expect(formDataAppendSpy).toHaveBeenCalledWith('tags', 'tag2');

  // Verify null/undefined fields were skipped
  const nullFieldCalls = formDataAppendSpy.mock.calls.filter((call) => call[0] === 'nullField');
  expect(nullFieldCalls.length).toBe(0);

  const undefinedFieldCalls = formDataAppendSpy.mock.calls.filter((call) => call[0] === 'undefinedField');
  expect(undefinedFieldCalls.length).toBe(0);

  // Test with object and options
  formDataAppendSpy.mockClear();

  const fileObject = {
    profile: Buffer.from('profile pic data'),
    document: Buffer.from('document data'),
  };

  const optionsObject = {
    profile: { filename: 'profile.jpg', contentType: 'image/jpeg' },
    document: { filename: 'doc.pdf', contentType: 'application/pdf' },
  };

  parameterBuilder('POST', 'http://restapi.com', '/files', config)
    .formData(fileObject, optionsObject)
    .build();

  // Can't easily verify Blob creation, but we can verify append was called
  expect(formDataAppendSpy).toHaveBeenCalled();
  expect(formDataAppendSpy.mock.calls.length).toBeGreaterThan(0);

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
    .formData({ file: fileContent })
    .build();

  // Verify append was called with the correct parameters
  expect(appendSpy).toHaveBeenCalledWith('file', fileContent);

  // Verify the request body is set to the FormData instance
  expect(request.body).toBe(mockFormData);

  // Cleanup
  appendSpy.mockRestore();
});

test('formUrlEncoded parameters', () => {
  const config = {
    FormData: jest.fn(),
    AbortController: jest.fn(),
    EventSource: jest.fn(),
    fetch: jest.fn(),
  } as unknown as FetchConfig;

  // Test with simple key-value pairs
  const formData = { username: 'testuser', password: 'testpass', remember: true };
  const request = parameterBuilder('POST', 'http://restapi.com', '/login', config)
    .formUrlEncoded(formData)
    .build();

  // Verify the content-type header is set correctly
  expect(request.headers?.['content-type']).toBe('application/x-www-form-urlencoded');
  // Verify the data is properly URL encoded (property order may vary)
  expect(request.body).toContain('username=testuser');
  expect(request.body).toContain('password=testpass');
  expect(request.body).toContain('remember=true');

  // Test with arrays in the data
  const arrayData = { items: ['item1', 'item2', 'item3'], id: 123 };
  const arrayRequest = parameterBuilder('POST', 'http://restapi.com', '/items', config)
    .formUrlEncoded(arrayData)
    .build();

  // Verify arrays are properly handled
  expect(arrayRequest.headers?.['content-type']).toBe('application/x-www-form-urlencoded');
  // With URLSearchParams, arrays are encoded as multiple key=value pairs
  expect(arrayRequest.body).toContain('items=item1');
  expect(arrayRequest.body).toContain('items=item2');
  expect(arrayRequest.body).toContain('items=item3');
  expect(arrayRequest.body).toContain('id=123');

  // Test with special characters that need encoding
  const specialCharsData = {
    query: 'search term with spaces',
    special: '!@#$%^&*()',
  };
  const specialCharsRequest = parameterBuilder('GET', 'http://restapi.com', '/search', config)
    .formUrlEncoded(specialCharsData)
    .build();

  // Verify URL encoding works for special characters
  // Note: URLSearchParams encodes spaces as '+' (form-urlencoded standard)
  expect(specialCharsRequest.body).toContain('query=search+term+with+spaces');
  expect(specialCharsRequest.body).toContain('special=%21%40%23%24%25%5E%26*%28%29');

  // Test with empty values
  const emptyValuesData = {
    empty: '', zero: 0, nullValue: null, undefinedValue: undefined,
  };
  const emptyValuesRequest = parameterBuilder('POST', 'http://restapi.com', '/empty', config)
    .formUrlEncoded(emptyValuesData as any)
    .build();

  // Empty string should be present, zero should be converted to string
  expect(emptyValuesRequest.body).toContain('empty=');
  expect(emptyValuesRequest.body).toContain('zero=0');

  // null & undefined values should be omitted
  expect(emptyValuesRequest.body).not.toContain('nullValue=');
  expect(emptyValuesRequest.body).not.toContain('undefinedValue=');

  // Test with optional properties
  const optionalData: Record<string, string | number | boolean | string[] | undefined | null> = {
    required: 'value',
    optional1: undefined,
    optional2: null,
    optionalArray: ['item1', 'item2'],
  };

  const optionalRequest = parameterBuilder('POST', 'http://restapi.com', '/optional', config)
    .formUrlEncoded(optionalData)
    .build();

  // Verify required properties are included
  expect(optionalRequest.body).toContain('required=value');

  // Verify undefined and null properties are omitted
  expect(optionalRequest.body).not.toContain('optional1=');
  expect(optionalRequest.body).not.toContain('optional2=');

  // Verify array handling with null/undefined items
  expect(optionalRequest.body).toContain('optionalArray=item1');
  expect(optionalRequest.body).toContain('optionalArray=item2');
  // No null or undefined values should appear
  expect((optionalRequest.body.match(/optionalArray=/g) || []).length).toBe(2);
});

test('formUrlEncoded with basic objects', () => {
  const config = {
    FormData: jest.fn(),
    AbortController: jest.fn(),
    EventSource: jest.fn(),
    fetch: jest.fn(),
  } as unknown as FetchConfig;

  // Test with simple object with primitive values
  const simpleObject = {
    username: 'johnsmith',
    age: 30,
    isActive: true,
    tags: ['user', 'premium'],
  };

  const simpleRequest = parameterBuilder('POST', 'http://restapi.com', '/user', config)
    .formUrlEncoded(simpleObject)
    .build();

  // Verify simple objects are correctly encoded
  expect(simpleRequest.body).toContain('username=johnsmith');
  expect(simpleRequest.body).toContain('age=30');
  expect(simpleRequest.body).toContain('isActive=true');
  expect(simpleRequest.body).toContain('tags=user');
  expect(simpleRequest.body).toContain('tags=premium');

  // Test with toString() conversion for non-primitive values
  const testDate = new Date('2023-01-01T00:00:00.000Z');
  const objectWithToString = {
    // Will be converted to string using toString() method
    date: testDate,
    // Arrays of primitives are handled individually
    numbers: [1, 2, 3],
  };

  const toStringRequest = parameterBuilder('POST', 'http://restapi.com', '/data', config)
    .formUrlEncoded(objectWithToString)
    .build();

  // Use URLSearchParams to get the exact expected string
  const expectedParams = new URLSearchParams();
  expectedParams.append('date', testDate.toString());
  expectedParams.append('numbers', '1');
  expectedParams.append('numbers', '2');
  expectedParams.append('numbers', '3');
  const expectedBody = expectedParams.toString();

  // Compare the entire body string - this should match exactly
  expect(toStringRequest.body).toBe(expectedBody);
});
