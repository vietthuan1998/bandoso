import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bootstrapSession,
  login as authLogin,
  logout as authLogout,
  subscribeToSessionExpiry,
} from '../services/auth/authClient';

export type AuthGateStatus = 'checking' | 'authenticated' | 'unauthenticated';

export type AuthGateState = {
  status: AuthGateStatus;
  sessionExpired: boolean;
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    bootstrapSession().then(session => {
      if (!mountedRef.current) return;
      setStatus(session ? 'authenticated' : 'unauthenticated');
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

  return { status, sessionExpired, login, logout };
}
