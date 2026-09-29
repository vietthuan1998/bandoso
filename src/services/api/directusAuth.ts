import { getStaticApiToken } from '../../config/apiAccessToken';
import {
  getAccessToken,
  subscribeToAccessTokenChange,
} from '../auth/authClient';

/**
 * Chọn token cho host dcu.huecity.vn (tile MVT + items Directus).
 *
 * Tài liệu mục 5 cấm để token trong mã client, nên accessToken của phiên
 * đăng nhập luôn được ưu tiên. Token tĩnh API_ACCESS_TOKEN (build vào bundle)
 * chỉ còn là DỰ PHÒNG tạm thời: host này hiện chưa nhận accessToken của BFF
 * (trả 401). Khi backend cho host nhận token BFF hoặc có proxy, bỏ
 * API_ACCESS_TOKEN khỏi .env là xong — không cần sửa code.
 *
 * Trạng thái "host có nhận accessToken không" được học từ request items qua
 * dcuAxios (2xx -> nhận, 401 -> không). Tile không thử lại được từng request
 * nên chỉ chuyển sang accessToken khi đã biết chắc host nhận nó.
 */
export type SessionTokenAcceptance = 'unknown' | 'accepted' | 'rejected';

let acceptance: SessionTokenAcceptance = 'unknown';
const listeners = new Set<() => void>();

export function getSessionTokenAcceptance(): SessionTokenAcceptance {
  return acceptance;
}

export function setSessionTokenAcceptance(next: SessionTokenAcceptance): void {
  if (acceptance === next) return;
  acceptance = next;
  listeners.forEach(listener => listener());
}

export function subscribeToDirectusAuthChange(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Token mới (đăng nhập, refresh, đăng xuất) -> học lại từ đầu.
subscribeToAccessTokenChange(() => {
  setSessionTokenAcceptance('unknown');
});

export type DirectusCredential =
  | { kind: 'session'; token: string }
  | { kind: 'static'; token: string }
  | null;

/**
 * Token cho request items. `allowSession` = false khi đang thử lại bằng token
 * tĩnh sau một lần 401 với accessToken.
 */
export function directusRequestCredential(
  allowSession = true,
): DirectusCredential {
  const session = getAccessToken();
  if (allowSession && session && acceptance !== 'rejected') {
    return { kind: 'session', token: session };
  }
  const staticToken = getStaticApiToken();
  return staticToken ? { kind: 'static', token: staticToken } : null;
}

/** Token cho tile: chỉ dùng accessToken khi host đã xác nhận nhận nó. */
export function directusTileToken(): string | null {
  const session = getAccessToken();
  if (session && acceptance === 'accepted') return session;
  return getStaticApiToken() ?? (acceptance === 'unknown' ? session : null);
}
