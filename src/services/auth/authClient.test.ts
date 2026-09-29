import axios from 'axios';
import Keychain from 'react-native-keychain';
import {
  AuthError,
  bootstrapSession,
  getAccessToken,
  getProfile,
  hasPermission,
  loadProfile,
  login,
  logout,
  refreshAccessToken,
  subscribeToAccessTokenChange,
  subscribeToSessionExpiry,
} from './authClient';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores the refresh token in the keychain and returns the access token on success', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-123',
          refreshToken: 'refresh-456',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });

    const session = await login('canbo01', 'matkhau123');

    expect(session.accessToken).toBe('access-123');
    const stored = await Keychain.getGenericPassword({
      service: 'huemaps-refresh-token',
    });
    expect(stored).not.toBe(false);
    if (stored !== false) {
      expect(stored.password).toBe('refresh-456');
    }
  });

  it('throws an AuthError with kind "invalid_credentials" on 401', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED' } } },
    });

    let caught: unknown;
    try {
      await login('canbo01', 'sai');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).kind).toBe('invalid_credentials');
  });

  it('throws an AuthError with kind "network" when there is no response', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: undefined,
    });

    let caught: unknown;
    try {
      await login('canbo01', 'matkhau123');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).kind).toBe('network');
  });
});

describe('refreshAccessToken', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
  });

  it('sends the stored refresh token, rotates it in the keychain, and returns the new access token', async () => {
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

    const accessToken = await refreshAccessToken();

    expect(accessToken).toBe('access-new');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      { refreshToken: 'refresh-old' },
      expect.anything(),
    );
    const stored = await Keychain.getGenericPassword({
      service: 'huemaps-refresh-token',
    });
    expect(stored !== false && stored.password).toBe('refresh-new');
  });

  it('dedupes concurrent calls into a single in-flight refresh request', async () => {
    let resolvePost: (value: unknown) => void = () => {};
    mockedAxios.post.mockReturnValueOnce(
      new Promise(resolve => {
        resolvePost = resolve;
      }),
    );

    const first = refreshAccessToken();
    const second = refreshAccessToken();

    resolvePost({
      data: {
        data: {
          accessToken: 'access-shared',
          refreshToken: 'refresh-shared',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toBe('access-shared');
    expect(secondResult).toBe('access-shared');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });

  it('clears the keychain and throws AuthError("session_expired") when refresh is rejected', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED' } } },
    });

    let caught: unknown;
    try {
      await refreshAccessToken();
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).kind).toBe('session_expired');
    const stored = await Keychain.getGenericPassword({
      service: 'huemaps-refresh-token',
    });
    expect(stored).toBe(false);
  });
});

describe('refreshAccessToken on transient failures', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.setGenericPassword('refreshToken', 'refresh-keep', {
      service: 'huemaps-refresh-token',
    });
  });

  it('keeps the refresh token and does not end the session when the network is down', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: undefined,
    });
    const expiry = jest.fn();
    const unsubscribe = subscribeToSessionExpiry(expiry);

    await expect(refreshAccessToken()).rejects.toMatchObject({
      kind: 'network',
    });

    const stored = await Keychain.getGenericPassword({
      service: 'huemaps-refresh-token',
    });
    expect(stored !== false && stored.password).toBe('refresh-keep');
    expect(expiry).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('keeps the refresh token on a 5xx from the server', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 502, data: { error: { code: 'UPSTREAM_ERROR' } } },
    });

    await expect(refreshAccessToken()).rejects.toMatchObject({
      kind: 'unknown',
    });

    const stored = await Keychain.getGenericPassword({
      service: 'huemaps-refresh-token',
    });
    expect(stored !== false && stored.password).toBe('refresh-keep');
  });
});

describe('logout', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-123',
          refreshToken: 'refresh-old',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });
    await login('canbo01', 'matkhau123');
    jest.clearAllMocks();
  });

  it('clears the keychain and in-memory access token even if the server call fails', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: undefined,
    });

    await logout();

    expect(getAccessToken()).toBeNull();
    const stored = await Keychain.getGenericPassword({
      service: 'huemaps-refresh-token',
    });
    expect(stored).toBe(false);
  });

  it('sends the access token and refresh token so the server can revoke the session', async () => {
    mockedAxios.post.mockResolvedValueOnce({});

    await logout();

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      { refreshToken: 'refresh-old' },
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-123' },
      }),
    );
  });
});

describe('profile (/auth/me)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.resetGenericPassword({ service: 'huemaps-refresh-token' });
  });

  it('exposes permissions from the login response immediately, then the /auth/me profile', async () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-p',
          refreshToken: 'refresh-p',
          tokenType: 'Bearer',
          expiresIn: 3600,
          roles: ['ward_officer'],
          permissions: ['data.read', 'statistics.read'],
          wardScopeType: 'ward',
        },
      },
    });

    await login('canbo01', 'matkhau');

    expect(hasPermission(getProfile(), 'statistics.read')).toBe(true);
    expect(hasPermission(getProfile(), 'report.export')).toBe(false);
    expect(getProfile()?.wardScope.type).toBe('ward');

    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: {
          id: 'u1',
          username: 'canbo01',
          fullName: 'Nguyễn Văn A',
          unit: 'UBND phường Thuận An',
          roles: ['ward_officer'],
          permissions: ['data.read', 'statistics.read'],
          wardScope: { type: 'ward', wardIds: ['19900', '19858'] },
          allowedCollections: ['thua_dat'],
        },
      },
    });
    const profile = await loadProfile();

    expect(mockedAxios.get).toHaveBeenLastCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer access-p' },
      }),
    );
    expect(profile?.fullName).toBe('Nguyễn Văn A');
    expect(profile?.wardScope).toEqual({
      type: 'ward',
      wardIds: ['19900', '19858'],
    });
  });

  it('clears the profile on logout', async () => {
    mockedAxios.post.mockResolvedValueOnce({});
    await logout();
    expect(getProfile()).toBeNull();
  });
});

describe('bootstrapSession', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.resetGenericPassword({ service: 'huemaps-refresh-token' });
  });

  it('returns null without calling the server when no refresh token is stored', async () => {
    const session = await bootstrapSession();

    expect(session).toBeNull();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('returns a session by refreshing when a refresh token is stored', async () => {
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-restored',
          refreshToken: 'refresh-restored',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });

    const session = await bootstrapSession();

    expect(session).toEqual({ accessToken: 'access-restored' });
  });
});

describe('subscribeToSessionExpiry', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
  });

  it('notifies subscribers when a refresh ultimately fails', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED' } } },
    });
    const listener = jest.fn();
    const unsubscribe = subscribeToSessionExpiry(listener);

    await expect(refreshAccessToken()).rejects.toBeInstanceOf(AuthError);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops notifying after unsubscribe', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { error: { code: 'UNAUTHORIZED' } } },
    });
    const listener = jest.fn();
    const unsubscribe = subscribeToSessionExpiry(listener);
    unsubscribe();

    await expect(refreshAccessToken()).rejects.toBeInstanceOf(AuthError);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('subscribeToAccessTokenChange', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await Keychain.resetGenericPassword({ service: 'huemaps-refresh-token' });
  });

  it('notifies subscribers with the new access token after a successful login', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-abc',
          refreshToken: 'refresh-abc',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });
    const listener = jest.fn();
    const unsubscribe = subscribeToAccessTokenChange(listener);

    await login('canbo01', 'matkhau123');

    expect(listener).toHaveBeenCalledWith('access-abc');
    unsubscribe();
  });

  it('notifies subscribers with the new access token after a successful refresh (so map tile auth stays current)', async () => {
    await Keychain.setGenericPassword('refreshToken', 'refresh-old', {
      service: 'huemaps-refresh-token',
    });
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        data: {
          accessToken: 'access-rotated',
          refreshToken: 'refresh-rotated',
          tokenType: 'Bearer',
          expiresIn: 28800,
        },
      },
    });
    const listener = jest.fn();
    const unsubscribe = subscribeToAccessTokenChange(listener);

    await refreshAccessToken();

    expect(listener).toHaveBeenCalledWith('access-rotated');
    unsubscribe();
  });

  it('notifies subscribers with null after logout so the stale tile header is dropped', async () => {
    mockedAxios.post.mockResolvedValueOnce({});
    const listener = jest.fn();
    const unsubscribe = subscribeToAccessTokenChange(listener);

    await logout();

    expect(listener).toHaveBeenCalledWith(null);
    unsubscribe();
  });
});
