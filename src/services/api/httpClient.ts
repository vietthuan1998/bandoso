import axios from 'axios';
import { getStaticApiToken, isApiBaseUrl } from '../../config/apiAccessToken';
import { API_BASE_URL, TIMEOUT } from '../../constants/url';
import { getToken } from '../auth/persistToken';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: '*/*',
  },
});

function resolveRequestUrl(baseURL?: string, url?: string): string | undefined {
  if (!url || /^https?:\/\//.test(url) || !baseURL) return url;
  return `${baseURL.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

// Chỉ gắn token cho request tới API_BASE_URL — client này cũng tải GeoJSON
// từ host khác (URL tuyệt đối), không được gửi token sang đó.
httpClient.interceptors.request.use(async config => {
  if (!isApiBaseUrl(resolveRequestUrl(config.baseURL, config.url))) {
    return config;
  }
  const token = (await getToken()) ?? getStaticApiToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function describeHttpError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const message = (error.response.data as { message?: string } | undefined)
        ?.message;
      return message ?? `HTTP ${error.response.status}`;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
