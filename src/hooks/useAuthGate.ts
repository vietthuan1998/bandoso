import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bootstrapSession,
  login as authLogin,
  logout as authLogout,
  subscribeToAccessTokenChange,
  subscribeToSessionExpiry,
  type UserProfile,
} from '../services/auth/authClient';
import { useAuthProfile } from './useAuthProfile';

/**
 * 'offline' = còn phiên đã lưu nhưng lúc mở app không liên lạc được server
 * để khôi phục — khác 'unauthenticated' (chưa đăng nhập / phiên bị thu hồi).
 */
export type AuthGateStatus =
  | 'checking'
  | 'authenticated'
  | 'unauthenticated'
  | 'offline';

export type AuthGateState = {
  status: AuthGateStatus;
  sessionExpired: boolean;
  /** Hồ sơ /auth/me (null khi chưa đăng nhập hoặc chưa tải xong). */
  profile: UserProfile | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Thử khôi phục lại phiên đã lưu (dùng khi 'offline'). */
  retry: () => Promise<void>;
};

/**
 * Cổng xác thực toàn app: phục hồi phiên lúc mở app (bootstrapSession), lắng
 * nghe sự kiện phiên hết hạn giữa chừng (subscribeToSessionExpiry), và cho
 * App.tsx quyết định hiển thị LoginScreen hay AppShell (thiết kế quyết định
 * #7: thay toàn màn hình, không phải modal).
 */
export function useAuthGate(): AuthGateState {
  const [status, setStatus] = useState<AuthGateStatus>('checking');
  const [sessionExpired, setSessionExpired] = useState(false);
  const profile = useAuthProfile();
  const mountedRef = useRef(true);

  const restore = useCallback(async () => {
    setStatus('checking');
    let next: AuthGateStatus;
    try {
      next = (await bootstrapSession()) ? 'authenticated' : 'unauthenticated';
    } catch {
      next = 'offline';
    }
    if (!mountedRef.current) return;
    // Trong lúc chờ, người dùng có thể đã đăng nhập hoặc phiên đã được một
    // request khác làm mới -> giữ trạng thái đó.
    setStatus(current => (current === 'checking' ? next : current));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    restore();
    return () => {
      mountedRef.current = false;
    };
  }, [restore]);

  useEffect(() => {
    return subscribeToSessionExpiry(() => {
      if (!mountedRef.current) return;
      setSessionExpired(true);
      setStatus('unauthenticated');
    });
  }, []);

  // Phiên được phục hồi muộn (vd. lúc mở app mất mạng, request sau đó
  // refresh thành công) -> chuyển sang đã đăng nhập mà không bắt nhập lại.
  useEffect(() => {
    return subscribeToAccessTokenChange(accessToken => {
      if (!mountedRef.current || !accessToken) return;
      setSessionExpired(false);
      setStatus('authenticated');
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await authLogin(username, password);
    setSessionExpired(false);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setSessionExpired(false);
    setStatus('unauthenticated');
  }, []);

  return { status, sessionExpired, profile, login, logout, retry: restore };
}
