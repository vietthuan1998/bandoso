jest.mock('../auth/persistToken', () => ({ getToken: jest.fn(async () => null) }));
jest.mock('../../config/apiAccessToken', () => ({
  getStaticApiToken: () => 'static-token',
  isApiBaseUrl: (url?: string) => !!url && url.startsWith('https://dcu.huecity.vn/'),
}));

import { httpClient } from './httpClient';

type Handler = { fulfilled: (config: any) => Promise<any> };
const requestInterceptor = (
  httpClient.interceptors.request as unknown as { handlers: Handler[] }
).handlers[0].fulfilled;

describe('httpClient auth interceptor', () => {
  it('attaches the static token to API_BASE_URL requests when not logged in', async () => {
    const config = await requestInterceptor({
      baseURL: 'https://dcu.huecity.vn',
      url: '/items/thua_dat',
      headers: {},
    });
    expect(config.headers.Authorization).toBe('Bearer static-token');
  });

  it('never sends the token to another host (absolute GeoJSON URL)', async () => {
    const config = await requestInterceptor({
      baseURL: 'https://dcu.huecity.vn',
      url: 'https://ioc-canhbao.hue.gov.vn/uploadfiles/40xaphuong_TPHue.json',
      headers: {},
    });
    expect(config.headers.Authorization).toBeUndefined();
  });
});
