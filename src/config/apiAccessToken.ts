import { API_ACCESS_TOKEN } from '@env';
import { API_BASE_URL } from '../constants/url';

/**
 * Token tĩnh (tuỳ chọn) cho request tới API_BASE_URL (dcu.huecity.vn — host
 * của tile MVT và items Directus) khi CHƯA đăng nhập, để khách vẫn xem được
 * lớp dữ liệu: host tile trả 403 cho request không có Authorization.
 *
 * Token phiên đăng nhập luôn được ưu tiên hơn token này. Lưu ý bảo mật: biến
 * .env bị build thẳng vào bundle JS nên ai có file APK/IPA đều trích được —
 * chỉ dùng token quyền đọc tối thiểu, thu hồi được.
 */
export function getStaticApiToken(): string | null {
  const token = API_ACCESS_TOKEN?.trim();
  return token ? token : null;
}

/**
 * true nếu `url` nằm dưới API_BASE_URL. So khớp theo tiền tố có dấu "/" để
 * không gắn nhầm token sang host khác (vd. dcu.huecity.vn.example.com).
 */
export function isApiBaseUrl(url: string | undefined): boolean {
  const base = API_BASE_URL.replace(/\/+$/, '');
  if (!url || !base) return false;
  return url === base || url.startsWith(`${base}/`);
}
