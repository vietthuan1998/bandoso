import axios from 'axios';
import { API_BASE_URL, TIMEOUT } from '../constants/url';
import { getToken } from '../store/persistToken';

export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: '*/*',
  },
});

httpClient.interceptors.request.use(async config => {
  const token = await getToken();
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
