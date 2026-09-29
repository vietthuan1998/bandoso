import { useSyncExternalStore } from 'react';
import {
  getProfile,
  subscribeToProfileChange,
  type UserProfile,
} from '../services/auth/authClient';

const subscribe = (listener: () => void) =>
  subscribeToProfileChange(() => listener());

/**
 * Hồ sơ /auth/me của phiên hiện tại (null = chưa đăng nhập). Dùng để ẩn/hiện
 * menu, nút theo `permissions` và hiển thị phạm vi — chỉ là trải nghiệm người
 * dùng, server vẫn kiểm tra quyền ở mọi request (tài liệu mục 10).
 */
export function useAuthProfile(): UserProfile | null {
  return useSyncExternalStore(subscribe, getProfile);
}
