import nock from 'nock';
import fetch from 'node-fetch';
import { fetchHelper, FetchConfig } from '../src/index';

describe('expect', () => {
  const mockFetch = jest.fn();
  jest.mock('node-fetch', () => mockFetch);

  nock('http://httpbin.org')
    .get('/status/404')
    .twice()
    .reply(404);

  nock('http://httpbin.org')
    .get('/status/500')
    .reply(500, { bad: true });

  test('Use expects', async () => {
    const promise = fetchHelper({ fetch } as unknown as FetchConfig, {
      url: 'http://httpbin.org/status/404',
      method: 'GET',
    });
    const expectPromise = promise as any;
    expect(expectPromise.expect).toBeTruthy(); // Should have an expect method;
    await expectPromise
      .expect(404)
      .then(({ status, body }: { status: number; body: any }) => {
        expect(status).toEqual(404); // Should catch the 404 when expected
        expect(body).toBeTruthy(); // Should have a body on the error
      })
      .catch(() => {
        throw new Error('Should not throw when expected');
      });

    const res = await fetchHelper(
      { fetch } as unknown as FetchConfig,
      { url: 'http://httpbin.org/status/404', method: 'GET' },
      { expect: [404] },
    );
    expect(res.status).toEqual(404); // Should catch the 404 when expected
    expect((res as any).body).toBeTruthy(); // Should have a body on the error
  });

  test('Throw', () => {
    expect(fetchHelper({ fetch } as unknown as FetchConfig, { url: 'http://httpbin.org/status/500', method: 'GET' }))
      .rejects.toThrow();
  });

  test('Retry', async () => {
    try {
      await fetchHelper({ fetch } as unknown as FetchConfig, { url: 'http://localhost:81/this-should-get-econnrefused', method: 'GET' });
      expect(true).toBeFalsy();
    } catch (error) {
      expect((error as any).retried).toEqual(3);
    }
  });
});
