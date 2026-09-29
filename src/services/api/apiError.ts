import axios from 'axios';

/**
 * Lỗi BFF luôn có dạng { error: { code, message, requestId } } (tài liệu mục
 * 2). Client phân nhánh theo `code` (bất biến), hiển thị thẳng `message` (đã
 * là tiếng Việt) và kèm `requestId` để đối soát log.
 */
export type ApiErrorInfo = {
  status: number | null;
  code: string | null;
  message: string | null;
  requestId: string | null;
  /** Không nhận được phản hồi (mất mạng, timeout). */
  network: boolean;
};

type ErrorBody = {
  error?: { code?: unknown; message?: unknown; requestId?: unknown };
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function fromBody(body: unknown) {
  const error = (body as ErrorBody | null | undefined)?.error;
  return {
    code: asString(error?.code),
    message: asString(error?.message),
    requestId: asString(error?.requestId),
  };
}

export function parseApiError(error: unknown): ApiErrorInfo {
  if (!axios.isAxiosError(error)) {
    return {
      status: null,
      code: null,
      message: null,
      requestId: null,
      network: false,
    };
  }
  if (!error.response) {
    return {
      status: null,
      code: null,
      message: null,
      requestId: null,
      network: true,
    };
  }
  return {
    status: error.response.status,
    ...fromBody(error.response.data),
    network: false,
  };
}

// Blob của React Native không có .text() — đọc qua FileReader.
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(blob);
  });
}

/**
 * Như parseApiError nhưng đọc được cả thân lỗi dạng Blob — request tải file
 * (responseType 'blob', vd. /reports/export) nhận JSON lỗi bọc trong Blob.
 */
export async function parseApiErrorAsync(
  error: unknown,
): Promise<ApiErrorInfo> {
  const info = parseApiError(error);
  const data = axios.isAxiosError(error) ? error.response?.data : undefined;
  if (info.code || typeof Blob === 'undefined' || !(data instanceof Blob)) {
    return info;
  }
  try {
    return { ...info, ...fromBody(JSON.parse(await blobText(data))) };
  } catch {
    return info;
  }
}

export function isUnauthorized(info: ApiErrorInfo): boolean {
  return info.code === 'UNAUTHORIZED' || (!info.code && info.status === 401);
}

/** FORBIDDEN, FORBIDDEN_WARD_SCOPE, FORBIDDEN_COLLECTION. */
export function isForbidden(info: ApiErrorInfo): boolean {
  return info.code ? info.code.startsWith('FORBIDDEN') : info.status === 403;
}

/**
 * Thông điệp hiển thị cho người dùng: ưu tiên message của server, không có
 * thì dùng câu dự phòng của app; luôn kèm mã tra cứu khi server trả requestId.
 */
export function describeApiError(
  info: ApiErrorInfo,
  fallback: string,
  formatRequestId: (requestId: string) => string,
): string {
  const text = info.message ?? fallback;
  return info.requestId ? `${text} ${formatRequestId(info.requestId)}` : text;
}
