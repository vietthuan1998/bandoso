import axios from 'axios';
import Keychain from 'react-native-keychain';
import { TIMEOUT } from '../../constants/url';
import { DCU_API_BASE_URL, REFRESH_TOKEN_KEYCHAIN_SERVICE } from '../../config/dcuAuthConfig';

export type AuthSession = {
  accessToken: string;
};

export type AuthErrorKind =
  | 'invalid_credentials'
  | 'network'
  | 'session_expired'
  | 'unknown';

export class AuthError extends Error {
  kind: AuthErrorKind;
  constructor(kind: AuthErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.name = 'AuthError';
  }
}

function toAuthError(error: unknown): AuthError {
  if (axios.isAxiosError(error)) {
    if (!error.response) return new AuthError('network');
    if (error.response.status === 401) return new AuthError('invalid_credentials');
  }
  return new AuthError('unknown');
}

type TokenResponse = {
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  };
};

let inMemoryAccessToken: string | null = null;
let inFlightRefresh: Promise<string> | null = null;
const sessionExpiryListeners = new Set<() => void>();

/**
 * App.tsx đăng ký để biết khi nào chuyển về màn đăng nhập (Bước 1-2: coi
 * refresh thất bại là một lần 401 bình thường, không phải lỗi).
 */
export function subscribeToSessionExpiry(listener: () => void): () => void {
  sessionExpiryListeners.add(listener);
  return () => sessionExpiryListeners.delete(listener);
}

const accessTokenChangeListeners = new Set<
  (accessToken: string | null) => void
>();

/**
 * mapTileAuth.ts đăng ký để cập nhật lại header xác thực tile (qua
 * TransformRequestManager.addHeader) mỗi khi accessToken đổi — kể cả khi
 * refresh diễn ra âm thầm giữa lúc người dùng đang xem bản đồ, không chỉ
 * lúc mount màn hình. Nhận null khi phiên bị xoá (đăng xuất/refresh thất bại).
 */
export function subscribeToAccessTokenChange(
  listener: (accessToken: string | null) => void,
): () => void {
  accessTokenChangeListeners.add(listener);
  return () => accessTokenChangeListeners.delete(listener);
}

function notifyAccessTokenChange(accessToken: string | null): void {
  accessTokenChangeListeners.forEach(listener => listener(accessToken));
}

async function storeRefreshToken(refreshToken: string): Promise<void> {
  await Keychain.setGenericPassword('refreshToken', refreshToken, {
    service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
  });
}

export async function login(
  username: string,
  password: string,
): Promise<AuthSession> {
  try {
    const response = await axios.post<TokenResponse>(
      `${DCU_API_BASE_URL}/auth/login`,
      { username, password },
      { timeout: TIMEOUT },
    );
    const { accessToken, refreshToken } = response.data.data;
    await storeRefreshToken(refreshToken);
    inMemoryAccessToken = accessToken;
    notifyAccessTokenChange(accessToken);
    return { accessToken };
  } catch (error) {
    throw toAuthError(error);
  }
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

/**
 * Gọi lúc mở app: accessToken chỉ sống trong bộ nhớ nên mất khi app khởi
 * động lại — nếu còn refreshToken hợp lệ trong keychain, phục hồi phiên mà
 * không bắt đăng nhập lại. Trả về null nếu chưa từng đăng nhập hoặc phiên đã
 * hết hạn (không coi là lỗi — đây là trạng thái bình thường khi mở app lần
 * đầu).
 */
export async function bootstrapSession(): Promise<AuthSession | null> {
  const stored = await Keychain.getGenericPassword({
    service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
  });
  if (stored === false) return null;
  try {
    const accessToken = await refreshAccessToken();
    return { accessToken };
  } catch {
    return null;
  }
}

async function doRefresh(): Promise<string> {
  const stored = await Keychain.getGenericPassword({
    service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
  });
  if (stored === false) {
    throw new AuthError('session_expired');
  }
  try {
    const response = await axios.post<TokenResponse>(
      `${DCU_API_BASE_URL}/auth/refresh`,
      { refreshToken: stored.password },
      { timeout: TIMEOUT },
    );
    const { accessToken, refreshToken } = response.data.data;
    await storeRefreshToken(refreshToken);
    inMemoryAccessToken = accessToken;
    notifyAccessTokenChange(accessToken);
    return accessToken;
  } catch (error) {
    await Keychain.resetGenericPassword({
      service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
    });
    inMemoryAccessToken = null;
    notifyAccessTokenChange(null);
    sessionExpiryListeners.forEach(listener => listener());
    const authError = toAuthError(error);
    throw new AuthError(
      authError.kind === 'invalid_credentials' ? 'session_expired' : authError.kind,
    );
  }
}

/**
 * Refresh tokens rotate and are single-use (API docs mục 3) — nhiều request
 * 401 cùng lúc phải dùng chung một lần gọi refresh, không được bắn song song.
 */
export function refreshAccessToken(): Promise<string> {
  if (!inFlightRefresh) {
    inFlightRefresh = doRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

/**
 * Best-effort: luôn xoá phiên cục bộ (keychain + bộ nhớ) dù server có phản
 * hồi lỗi hay không — người dùng bấm đăng xuất mong đợi thoát ngay lập tức.
 */
export async function logout(): Promise<void> {
  try {
    await axios.post(
      `${DCU_API_BASE_URL}/auth/logout`,
      {},
      { timeout: TIMEOUT },
    );
  } catch {
    // best-effort — vẫn xoá phiên cục bộ dù gọi server thất bại
  } finally {
    await Keychain.resetGenericPassword({
      service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
    });
    inMemoryAccessToken = null;
    notifyAccessTokenChange(null);
  }
}
