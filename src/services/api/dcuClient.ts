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
 * Chưa đăng nhập (không có header từ dcuHeaders) mà request tới API_BASE_URL
 * -> gắn token tĩnh API_ACCESS_TOKEN nếu có. Không đụng request tới host
 * khác (vd. BFF dcudata.cgb.vn) — token tĩnh chỉ dành cho API_BASE_URL.
 */
dcuAxios.interceptors.request.use(config => {
  const staticToken = getStaticApiToken();
  if (staticToken && !config.headers?.Authorization && isApiBaseUrl(config.url)) {
    config.headers.Authorization = `Bearer ${staticToken}`;
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

export function dcuItemsUrl(collection: string): string {
  return `https://${MVT_TILE_HOST}/items/${collection}`;
}
