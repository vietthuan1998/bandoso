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

export type AuthGateStatus = 'checking' | 'authenticated' | 'unauthenticated';

export type AuthGateState = {
  status: AuthGateStatus;
  sessionExpired: boolean;
  /** Hồ sơ /auth/me (null khi chưa đăng nhập hoặc chưa tải xong). */
  profile: UserProfile | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    mountedRef.current = true;
    bootstrapSession().then(session => {
      if (!mountedRef.current) return;
      setStatus(current =>
        session
          ? 'authenticated'
          : current === 'checking'
          ? 'unauthenticated'
          : current,
      );
    });
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  return { status, sessionExpired, profile, login, logout };
}
