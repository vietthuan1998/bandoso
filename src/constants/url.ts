import { API_BASE_URL as ENV_API_BASE_URL, API_TIMEOUT as ENV_API_TIMEOUT } from '@env';

/**
 * Base URL cho axios client (src/api/httpClient.ts). Giá trị thật khai báo
 * trong .env — xem .env.example. Rơi về chuỗi rỗng khi thiếu biến để lỗi
 * xuất hiện rõ ràng ở lúc gọi API thay vì "undefined" âm thầm.
 */
export const API_BASE_URL = ENV_API_BASE_URL ?? '';

/**
 * Timeout (ms) cho mỗi request axios. Rơi về giá trị mặc định 15s khi biến
 * môi trường thiếu hoặc không parse được thành số.
 */
const DEFAULT_TIMEOUT = 15000;
const parsedTimeout = Number(ENV_API_TIMEOUT);
export const TIMEOUT =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT;
