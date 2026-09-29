import axios from 'axios';
import Keychain from 'react-native-keychain';
import { TIMEOUT } from '../../constants/url';
import { DCU_API_BASE_URL, REFRESH_TOKEN_KEYCHAIN_SERVICE } from '../../config/dcuAuthConfig';
import { isUnauthorized, parseApiError } from '../api/apiError';

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
  const info = parseApiError(error);
  if (info.network) return new AuthError('network');
  if (isUnauthorized(info)) {
    return new AuthError('invalid_credentials', info.message ?? undefined);
  }
  return new AuthError('unknown', info.message ?? undefined);
}

type TokenResponse = {
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
    roles?: string[];
    permissions?: string[];
    wardScopeType?: 'all' | 'ward';
  };
};

export type WardScope = { type: 'all' | 'ward'; wardIds: string[] };

/** GET /auth/me — hồ sơ, vai trò, quyền và phạm vi của tài khoản. */
export type UserProfile = {
  id: string | null;
  username: string | null;
  fullName: string | null;
  unit: string | null;
  roles: string[];
  permissions: string[];
  wardScope: WardScope;
  allowedCollections: string[];
};

let inMemoryAccessToken: string | null = null;
let inFlightRefresh: Promise<string> | null = null;
let currentProfile: UserProfile | null = null;
const sessionExpiryListeners = new Set<() => void>();
const profileListeners = new Set<(profile: UserProfile | null) => void>();

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

export function getProfile(): UserProfile | null {
  return currentProfile;
}

export function subscribeToProfileChange(
  listener: (profile: UserProfile | null) => void,
): () => void {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}

function setProfile(profile: UserProfile | null): void {
  currentProfile = profile;
  profileListeners.forEach(listener => listener(profile));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeProfile(raw: Record<string, unknown>): UserProfile {
  const scope = (raw.wardScope ?? {}) as { type?: unknown; wardIds?: unknown };
  return {
    id: raw.id != null ? String(raw.id) : null,
    username: typeof raw.username === 'string' ? raw.username : null,
    fullName: typeof raw.fullName === 'string' ? raw.fullName : null,
    unit: typeof raw.unit === 'string' ? raw.unit : null,
    roles: stringList(raw.roles),
    permissions: stringList(raw.permissions),
    wardScope: {
      type: scope.type === 'ward' ? 'ward' : 'all',
      wardIds: stringList(scope.wardIds),
    },
    allowedCollections: stringList(raw.allowedCollections),
  };
}

/**
 * Hồ sơ tạm từ phản hồi login/refresh (đã có roles, permissions,
 * wardScopeType) để UI ẩn/hiện đúng ngay — /auth/me bổ sung chi tiết sau.
 */
function provisionalProfile(data: TokenResponse['data']): UserProfile | null {
  if (!data.permissions && !data.roles) return null;
  return {
    id: null,
    username: null,
    fullName: null,
    unit: null,
    roles: data.roles ?? [],
    permissions: data.permissions ?? [],
    wardScope: {
      type: data.wardScopeType === 'ward' ? 'ward' : 'all',
      wardIds: currentProfile?.wardScope.wardIds ?? [],
    },
    allowedCollections: currentProfile?.allowedCollections ?? [],
  };
}

async function storeRefreshToken(refreshToken: string): Promise<void> {
  await Keychain.setGenericPassword('refreshToken', refreshToken, {
    service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
  });
}

function applyTokens(data: TokenResponse['data']): void {
  inMemoryAccessToken = data.accessToken;
  notifyAccessTokenChange(data.accessToken);
  const provisional = provisionalProfile(data);
  if (provisional && !currentProfile) setProfile(provisional);
}

function clearLocalSession(): void {
  inMemoryAccessToken = null;
  notifyAccessTokenChange(null);
  setProfile(null);
}

/** GET /auth/me. Lỗi không chặn phiên — giữ hồ sơ tạm từ login. */
export async function loadProfile(): Promise<UserProfile | null> {
  const accessToken = inMemoryAccessToken;
  if (!accessToken) return null;
  try {
    const response = await axios.get<{ data: Record<string, unknown> }>(
      `${DCU_API_BASE_URL}/auth/me`,
      {
        timeout: TIMEOUT,
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    // Phiên đã đổi trong lúc chờ (đăng xuất/đăng nhập tài khoản khác).
    if (inMemoryAccessToken !== accessToken) return currentProfile;
    const profile = normalizeProfile(response.data.data);
    setProfile(profile);
    return profile;
  } catch {
    return currentProfile;
  }
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
    const data = response.data.data;
    await storeRefreshToken(data.refreshToken);
    setProfile(null);
    applyTokens(data);
    loadProfile().catch(() => {});
    return { accessToken: data.accessToken };
  } catch (error) {
    throw toAuthError(error);
  }
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

/**
 * Gọi lúc mở app: accessToken chỉ sống trong bộ nhớ nên mất khi app khởi
 * động lại — nếu còn refreshToken trong keychain, phục hồi phiên mà không bắt
 * đăng nhập lại.
 * - Trả null: chưa từng đăng nhập, hoặc phiên đã bị thu hồi (401).
 * - Ném AuthError 'network' / 'unknown': không liên lạc được server; refresh
 *   token vẫn được giữ để thử lại (không phải đăng xuất).
 */
export async function bootstrapSession(): Promise<AuthSession | null> {
  const stored = await Keychain.getGenericPassword({
    service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
  });
  if (stored === false) return null;
  try {
    const accessToken = await refreshAccessToken();
    loadProfile().catch(() => {});
    return { accessToken };
  } catch (error) {
    if (error instanceof AuthError && error.kind !== 'session_expired') {
      throw error;
    }
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
  let data: TokenResponse['data'];
  try {
    const response = await axios.post<TokenResponse>(
      `${DCU_API_BASE_URL}/auth/refresh`,
      { refreshToken: stored.password },
      { timeout: TIMEOUT },
    );
    data = response.data.data;
  } catch (error) {
    const info = parseApiError(error);
    // Chỉ 401 mới nghĩa là phiên đã bị thu hồi (tài liệu mục 3). Mất mạng
    // hay lỗi máy chủ thì giữ nguyên refreshToken — xoá đi là đăng xuất
    // người dùng oan chỉ vì chập chờn mạng.
    if (!isUnauthorized(info)) {
      throw new AuthError(info.network ? 'network' : 'unknown');
    }
    await Keychain.resetGenericPassword({
      service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
    });
    clearLocalSession();
    sessionExpiryListeners.forEach(listener => listener());
    throw new AuthError('session_expired', info.message ?? undefined);
  }
  await storeRefreshToken(data.refreshToken);
  applyTokens(data);
  return data.accessToken;
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
 * POST /auth/logout kèm accessToken + refreshToken để server thu hồi đúng
 * phiên. Best-effort: luôn xoá phiên cục bộ (keychain + bộ nhớ) dù server có
 * phản hồi lỗi hay không — người dùng bấm đăng xuất mong đợi thoát ngay.
 */
export async function logout(): Promise<void> {
  try {
    const stored = await Keychain.getGenericPassword({
      service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
    });
    const accessToken = inMemoryAccessToken;
    await axios.post(
      `${DCU_API_BASE_URL}/auth/logout`,
      stored === false ? {} : { refreshToken: stored.password },
      {
        timeout: TIMEOUT,
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : undefined,
      },
    );
  } catch {
    // best-effort — vẫn xoá phiên cục bộ dù gọi server thất bại
  } finally {
    await Keychain.resetGenericPassword({
      service: REFRESH_TOKEN_KEYCHAIN_SERVICE,
    });
    clearLocalSession();
  }
}

export function hasPermission(
  profile: UserProfile | null,
  permission: string,
): boolean {
  return !!profile && profile.permissions.includes(permission);
}
