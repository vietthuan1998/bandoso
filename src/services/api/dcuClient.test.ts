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
      get: jest.fn(),
      isAxiosError: actualAxios.isAxiosError,
    },
  };
});

const mockedAxios = require('axios').default;

jest.mock('../../constants/url', () => ({
  BASE_URL: 'https://bff.test/api',
  API_V1_URL: 'https://bff.test/api/v1',
  DIRECTUS_BASE_URL: 'https://bff.test/api/directus',
  TIMEOUT: 15000,
}));

import { dcuAxios, dcuHeaders, dcuItemsUrl, isDirectusUrl } from './dcuClient';
import { login, logout } from '../auth/authClient';

const ITEMS_BTS = 'https://bff.test/api/directus/items/bts';

const mockInstance = dcuAxios as unknown as {
  interceptors: { request: { use: jest.Mock }; response: { use: jest.Mock } };
  request: jest.Mock;
};
// Interceptor đăng ký một lần lúc import module — lấy handler trước khi
// jest.clearAllMocks() xoá lịch sử gọi của .use().
const responseErrorHandler =
  mockInstance.interceptors.response.use.mock.calls[0][1];
const requestHandler = mockInstance.interceptors.request.use.mock.calls[0][0];

function tokenResponse(accessToken: string, refreshToken: string) {
  return {
    data: {
      data: { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: 3600 },
    },
  };
}

describe('Directus URL', () => {
  it('builds items URLs from BASE_URL + /directus/items/{collection}', () => {
    expect(dcuItemsUrl('bts')).toBe(ITEMS_BTS);
  });

  it('recognises only Directus URLs under BASE_URL', () => {
    expect(isDirectusUrl(ITEMS_BTS)).toBe(true);
    expect(isDirectusUrl('https://bff.test/api/v1/statistics/summary')).toBe(
      false,
    );
    expect(isDirectusUrl('https://bff.test/api/directusX/items/bts')).toBe(
      false,
    );
    expect(isDirectusUrl(undefined)).toBe(false);
  });
});

describe('Directus request credential', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockRejectedValue(new Error('no /auth/me'));
  });

  it('sends no token at all for guests (the BFF proxy authenticates server-side)', async () => {
    mockedAxios.post.mockResolvedValueOnce({});
    await logout();
    const config = requestHandler({
      url: ITEMS_BTS,
      headers: { Authorization: 'Bearer stale' },
    });
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('sends the current session access token when signed in', async () => {
    mockedAxios.post.mockResolvedValueOnce(
      tokenResponse('access-session', 'refresh-1'),
    );
    await login('canbo01', 'matkhau');
    const config = requestHandler({ url: ITEMS_BTS, headers: {} });
    expect(config.headers.Authorization).toBe('Bearer access-session');
  });

  it('never touches API v1 requests', () => {
    const bff = requestHandler({
      url: 'https://bff.test/api/v1/statistics/summary',
      headers: { Authorization: 'Bearer from-call-site' },
    });
    expect(bff.headers.Authorization).toBe('Bearer from-call-site');
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
    mockedAxios.post.mockResolvedValueOnce(
      tokenResponse('access-new', 'refresh-new'),
    );
    mockInstance.request.mockResolvedValueOnce({ data: { ok: true } });

    const result = await responseErrorHandler({
      config: { url: ITEMS_BTS, headers: {} },
      response: { status: 401 },
    });

    expect(result).toEqual({ data: { ok: true } });
    const retriedConfig = mockInstance.request.mock.calls[0][0];
    expect(retriedConfig._dcuRetried).toBe(true);
    expect(retriedConfig.headers.Authorization).toBe('Bearer access-new');
    expect(dcuHeaders()).toEqual({ Authorization: 'Bearer access-new' });
  });

  it('rejects with the original error when the status is not 401', async () => {
    const notFoundError = {
      config: { url: 'https://bff.test/api/v1/x', headers: {} },
      response: { status: 404 },
    };

    await expect(responseErrorHandler(notFoundError)).rejects.toBe(
      notFoundError,
    );
    expect(mockInstance.request).not.toHaveBeenCalled();
  });

  it('rejects with the original error when refresh fails (no refresh token stored)', async () => {
    const unauthorizedError = {
      config: { url: ITEMS_BTS, headers: {} },
      response: { status: 401 },
    };

    await expect(responseErrorHandler(unauthorizedError)).rejects.toBe(
      unauthorizedError,
    );
    expect(mockInstance.request).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('does not retry a request that was already retried once', async () => {
    const alreadyRetriedError = {
      config: {
        url: 'https://bff.test/api/v1/x',
        headers: {},
        _dcuRetried: true,
      },
      response: { status: 401 },
    };

    await expect(responseErrorHandler(alreadyRetriedError)).rejects.toBe(
      alreadyRetriedError,
    );
    expect(mockInstance.request).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
