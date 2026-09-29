import { API_TIMEOUT as ENV_API_TIMEOUT, BASE_URL as ENV_BASE_URL } from '@env';

/**
 * Kiểm tra BASE_URL: bắt buộc khai báo trong .env (không có domain mặc định
 * để một bản build thiếu cấu hình không âm thầm gọi nhầm môi trường). Bỏ "/"
 * ở cuối.
 */
export function resolveBaseUrl(raw: string | undefined): string {
  const value = raw?.trim().replace(/\/+$/, '') ?? '';
  if (!/^https?:\/\/[^/\s]+/.test(value)) {
    throw new Error(
      value
        ? `BASE_URL trong .env không hợp lệ: "${value}" (cần dạng https://host/api).`
        : 'Thiếu BASE_URL trong .env. Sao chép .env.example thành .env, điền ' +
          'BASE_URL rồi chạy lại Metro với --reset-cache.',
    );
  }
  return value;
}

/** Gốc API của BFF, vd. https://dcudata.cgb.vn/api. */
export const BASE_URL = resolveBaseUrl(ENV_BASE_URL);

/** API BFF phiên bản 1: /auth, /map, /catalog, /statistics, /reports. */
export const API_V1_URL = `${BASE_URL}/v1`;

/**
 * Directus đi qua BFF: `${DIRECTUS_BASE_URL}/items/{collection}` và tile
 * `${DIRECTUS_BASE_URL}/mvt/{z}/{x}/{y}.mvt`. BFF tự gắn xác thực phía server
 * nên client không giữ token nào cho Directus (tài liệu mục 5).
 */
export const DIRECTUS_BASE_URL = `${BASE_URL}/directus`;

const DEFAULT_TIMEOUT = 15000;
const parsedTimeout = Number(ENV_API_TIMEOUT);
export const TIMEOUT =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : DEFAULT_TIMEOUT;
