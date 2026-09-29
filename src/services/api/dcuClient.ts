import axios, { type AxiosRequestConfig } from 'axios';
import { getAccessToken, refreshAccessToken } from '../auth/authClient';
import { DIRECTUS_BASE_URL, TIMEOUT } from '../../constants/url';

export const dcuAxios = axios.create({ timeout: TIMEOUT });

export function dcuHeaders(): { Authorization: string } | undefined {
  const accessToken = getAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

/** Directus đi qua BFF: BASE_URL + "/directus/items/{collection}". */
export function dcuItemsUrl(collection: string): string {
  return `${DIRECTUS_BASE_URL}/items/${collection}`;
}

/** true nếu `url` là request Directus (so tiền tố có "/" để tránh nhầm host). */
export function isDirectusUrl(url: string | undefined): boolean {
  return !!url && url.startsWith(`${DIRECTUS_BASE_URL}/`);
}

type RetriableConfig = AxiosRequestConfig & { _dcuRetried?: boolean };

/**
 * Request Directus (proxy BFF): gửi accessToken của phiên nếu đã đăng nhập,
 * chưa đăng nhập thì không gửi gì — BFF tự gắn xác thực phía server, client
 * không giữ token tĩnh nào (tài liệu mục 5). Luôn lấy token mới nhất lúc gửi
 * để request thử lại sau refresh không mang token cũ.
 */
dcuAxios.interceptors.request.use(config => {
  if (!isDirectusUrl(config.url)) return config;
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

/**
 * (D4) Bắt 401 -> refresh (đã gộp concurrent trong authClient.ts) -> thử lại
 * request gốc đúng một lần. Refresh thất bại thì để lỗi gốc đi tiếp —
 * subscribeToSessionExpiry (authClient.ts) lo việc chuyển về màn đăng nhập.
 * Không có refresh token (khách) thì refreshAccessToken thất bại ngay, không
 * gọi mạng.
 */
dcuAxios.interceptors.response.use(
  response => response,
  async error => {
    const config = error?.config as RetriableConfig | undefined;
    const status = error?.response?.status;
    if (!config || status !== 401 || config._dcuRetried) {
      return Promise.reject(error);
    }
    try {
      await refreshAccessToken();
    } catch {
      return Promise.reject(error);
    }
    const retryConfig: RetriableConfig = {
      ...config,
      _dcuRetried: true,
      headers: { ...config.headers, ...dcuHeaders() },
    };
    return dcuAxios.request(retryConfig);
  },
);
