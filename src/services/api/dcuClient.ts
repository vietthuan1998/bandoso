import axios, { type AxiosRequestConfig } from 'axios';
import { getStaticApiToken, isApiBaseUrl } from '../../config/apiAccessToken';
import { getAccessToken, refreshAccessToken } from '../auth/authClient';
import { TIMEOUT } from '../../constants/url';
import { MVT_TILE_HOST } from '../map/mvtLayers';

export const dcuAxios = axios.create({ timeout: TIMEOUT });

export function dcuHeaders(): { Authorization: string } | undefined {
  const accessToken = getAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

type RetriableConfig = AxiosRequestConfig & { _dcuRetried?: boolean };

/**
 * Request tới API_BASE_URL (Directus dcu.huecity.vn) luôn dùng token tĩnh
 * API_ACCESS_TOKEN: Directus không nhận accessToken phiên BFF (dcudata.cgb.vn)
 * — gửi token phiên sang đó bị 401. Call site vẫn truyền dcuHeaders() nên
 * phải ghi đè ở đây. Không có token tĩnh -> bỏ header (403 như khách) thay vì
 * gửi token phiên chắc chắn bị từ chối. Request tới host khác (BFF) giữ nguyên.
 */
dcuAxios.interceptors.request.use(config => {
  if (!isApiBaseUrl(config.url)) return config;
  const staticToken = getStaticApiToken();
  if (staticToken) {
    config.headers.Authorization = `Bearer ${staticToken}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

/**
 * (D4) Bắt 401 -> refresh (đã gộp concurrent trong authClient.ts) -> thử lại
 * request gốc đúng một lần. Refresh thất bại thì để lỗi gốc đi tiếp —
 * subscribeToSessionExpiry (authClient.ts) lo việc chuyển về màn đăng nhập,
 * interceptor này chỉ lo phần request/retry.
 */
dcuAxios.interceptors.response.use(
  response => response,
  async error => {
    const config = error?.config as RetriableConfig | undefined;
    const status = error?.response?.status;
    // 401 từ Directus (API_BASE_URL) không liên quan phiên BFF — refresh
    // không giúp gì mà còn tiêu refresh token xoay vòng.
    if (
      !config ||
      status !== 401 ||
      config._dcuRetried ||
      isApiBaseUrl(config.url)
    ) {
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

export function dcuItemsUrl(collection: string): string {
  return `https://${MVT_TILE_HOST}/items/${collection}`;
}
