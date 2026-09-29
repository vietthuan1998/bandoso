import axios, { type AxiosRequestConfig } from 'axios';
import { isApiBaseUrl } from '../../config/apiAccessToken';
import { getAccessToken, refreshAccessToken } from '../auth/authClient';
import { TIMEOUT } from '../../constants/url';
import { MVT_TILE_HOST } from '../map/mvtLayers';
import {
  directusRequestCredential,
  getSessionTokenAcceptance,
  setSessionTokenAcceptance,
} from './directusAuth';

export const dcuAxios = axios.create({ timeout: TIMEOUT });

export function dcuHeaders(): { Authorization: string } | undefined {
  const accessToken = getAccessToken();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

type RetriableConfig = AxiosRequestConfig & {
  _dcuRetried?: boolean;
  /** Đang thử lại request Directus bằng token tĩnh sau 401 với accessToken. */
  _dcuStaticFallback?: boolean;
  /** Loại token interceptor đã gắn cho request Directus. */
  _dcuCredential?: 'session' | 'static';
};

/**
 * Request tới API_BASE_URL (Directus dcu.huecity.vn): ưu tiên accessToken của
 * phiên đăng nhập, token tĩnh chỉ là dự phòng (xem directusAuth.ts). Không có
 * token nào -> bỏ header (403 như khách). Request tới host khác (BFF) giữ nguyên.
 */
dcuAxios.interceptors.request.use(config => {
  if (!isApiBaseUrl(config.url)) return config;
  const retriable = config as typeof config & RetriableConfig;
  const credential = directusRequestCredential(!retriable._dcuStaticFallback);
  if (credential) {
    config.headers.Authorization = `Bearer ${credential.token}`;
    retriable._dcuCredential = credential.kind;
  } else {
    delete config.headers.Authorization;
    retriable._dcuCredential = undefined;
  }
  return config;
});

/**
 * Directus: 2xx với accessToken -> ghi nhận host nhận token phiên (tile cũng
 * chuyển sang dùng nó); 401 với accessToken -> ghi nhận không nhận, thử lại
 * đúng một lần bằng token tĩnh.
 *
 * BFF: (D4) bắt 401 -> refresh (đã gộp concurrent trong authClient.ts) -> thử
 * lại request gốc đúng một lần. Refresh thất bại thì để lỗi gốc đi tiếp —
 * subscribeToSessionExpiry (authClient.ts) lo việc chuyển về màn đăng nhập.
 */
dcuAxios.interceptors.response.use(
  response => {
    const config = response?.config as RetriableConfig | undefined;
    if (
      config?._dcuCredential === 'session' &&
      getSessionTokenAcceptance() === 'unknown'
    ) {
      setSessionTokenAcceptance('accepted');
    }
    return response;
  },
  async error => {
    const config = error?.config as RetriableConfig | undefined;
    const status = error?.response?.status;
    if (!config || status !== 401) return Promise.reject(error);

    if (isApiBaseUrl(config.url)) {
      // 401 từ Directus không liên quan phiên BFF — refresh không giúp gì mà
      // còn tiêu refresh token xoay vòng.
      if (config._dcuCredential !== 'session' || config._dcuStaticFallback) {
        return Promise.reject(error);
      }
      setSessionTokenAcceptance('rejected');
      const fallback = directusRequestCredential(false);
      if (!fallback) return Promise.reject(error);
      return dcuAxios.request({
        ...config,
        _dcuStaticFallback: true,
      } as RetriableConfig);
    }

    if (config._dcuRetried) return Promise.reject(error);
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
