import {
  API_BASE_URL as ENV_API_BASE_URL,
  API_TIMEOUT as ENV_API_TIMEOUT,
} from '@env';

export const API_BASE_URL = ENV_API_BASE_URL ?? '';

const DEFAULT_TIMEOUT = 15000;
const parsedTimeout = Number(ENV_API_TIMEOUT);
export const TIMEOUT =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : DEFAULT_TIMEOUT;
