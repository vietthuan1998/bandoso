import Keychain from 'react-native-keychain';

jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  const mockInstance = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    request: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      ...actualAxios,
      create: jest.fn(() => mockInstance),
      post: jest.fn(),
      isAxiosError: actualAxios.isAxiosError,
    },
  };
});

 
const mockedAxios = require('axios').default;

jest.mock('../../config/apiAccessToken', () => ({
  getStaticApiToken: jest.fn(() => 'static-token'),
  isApiBaseUrl: (url?: string) => !!url && url.startsWith('https://dcu.huecity.vn/'),
}));

import { dcuAxios, dcuHeaders } from './dcuClient';

const mockInstance = dcuAxios as unknown as {
  interceptors: { request: { use: jest.Mock }; response: { use: jest.Mock } };
  request: jest.Mock;
};
// Interceptor đăng ký một lần lúc import module — lấy handler trước khi
// jest.clearAllMocks() xoá lịch sử gọi của .use().
const responseErrorHandler =
  mockInstance.interceptors.response.use.mock.calls[0][1];
const requestHandler = mockInstance.interceptors.request.use.mock.calls[0][0];

describe('dcuAxios static token interceptor', () => {
  it('adds the static token to API_BASE_URL requests that carry no Authorization', () => {
    const config = requestHandler({
      url: 'https://dcu.huecity.vn/items/bts',
      headers: {},
    });
    expect(config.headers.Authorization).toBe('Bearer static-token');
  });

  it('keeps the session token and never touches other hosts', () => {
    const logged = requestHandler({
      url: 'https://dcu.huecity.vn/items/bts',
      headers: { Authorization: 'Bearer access-session' },
    });
    expect(logged.headers.Authorization).toBe('Bearer access-session');

    const bff = requestHandler({
      url: 'https://dcudata.cgb.vn/api/v1/statistics/summary',
      headers: {},
    });
    expect(bff.headers.Authorization).toBeUndefined();
  });
});

describe('dcuAxios 401 interceptor', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.resetGenericPassword({ service: 'huemaps-refresh-token' });
  });

  it('refreshes the access token once and retries the original request on 401', async () => {
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-new',
          refreshToken: 'refresh-new',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });
    mockInstance.request.mockResolvedValueOnce({ data: { ok: true } });

    const originalRequestConfig = { url: '/items/thua_dat', headers: {} };

    const result = await responseErrorHandler({
      isAxiosError: true,
      config: originalRequestConfig,
      response: { status: 401 },
    });

    expect(result).toEqual({ data: { ok: true } });
    expect(mockInstance.request).toHaveBeenCalledTimes(1);
    const retriedConfig = mockInstance.request.mock.calls[0][0];
    expect(retriedConfig.headers.Authorization).toBe('Bearer access-new');
    expect(dcuHeaders()).toEqual({ Authorization: 'Bearer access-new' });
  });

  it('rejects with the original error when the status is not 401', async () => {
    const notFoundError = {
      isAxiosError: true,
      config: { url: '/items/thua_dat', headers: {} },
      response: { status: 404 },
    };

    await expect(responseErrorHandler(notFoundError)).rejects.toBe(
      notFoundError,
    );
    expect(mockInstance.request).not.toHaveBeenCalled();
  });

  it('rejects with the original error when refresh fails (no refresh token stored)', async () => {
    const unauthorizedError = {
      isAxiosError: true,
      config: { url: '/items/thua_dat', headers: {} },
      response: { status: 401 },
    };

    await expect(responseErrorHandler(unauthorizedError)).rejects.toBe(
      unauthorizedError,
    );
    expect(mockInstance.request).not.toHaveBeenCalled();
  });

  it('does not retry a request that was already retried once', async () => {
    const alreadyRetriedError = {
      isAxiosError: true,
      config: { url: '/items/thua_dat', headers: {}, _dcuRetried: true },
      response: { status: 401 },
    };

    await expect(responseErrorHandler(alreadyRetriedError)).rejects.toBe(
      alreadyRetriedError,
    );
    expect(mockInstance.request).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
