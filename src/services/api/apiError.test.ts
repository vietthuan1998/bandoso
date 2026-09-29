import { AxiosError, AxiosHeaders } from 'axios';
import {
  describeApiError,
  describeHttpError,
  isForbidden,
  isUnauthorized,
  parseApiError,
} from './apiError';

function httpError(status: number, data: unknown = {}): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', String(status), config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

describe('parseApiError', () => {
  it('reads code, message and requestId from the BFF error envelope', () => {
    const info = parseApiError(
      httpError(403, {
        error: {
          code: 'FORBIDDEN_WARD_SCOPE',
          message: 'Tài khoản không có quyền xem dữ liệu của phường/xã này.',
          requestId: 'b1f0a2c4',
        },
      }),
    );
    expect(info).toEqual({
      status: 403,
      code: 'FORBIDDEN_WARD_SCOPE',
      message: 'Tài khoản không có quyền xem dữ liệu của phường/xã này.',
      requestId: 'b1f0a2c4',
      network: false,
    });
    expect(isForbidden(info)).toBe(true);
    expect(isUnauthorized(info)).toBe(false);
  });

  it('branches on error.code, not on the HTTP status, when a code is present', () => {
    const info = parseApiError(
      httpError(403, { error: { code: 'UNAUTHORIZED' } }),
    );
    expect(isUnauthorized(info)).toBe(true);
    expect(isForbidden(info)).toBe(false);
  });

  it('falls back to the HTTP status when the body has no envelope', () => {
    expect(isUnauthorized(parseApiError(httpError(401)))).toBe(true);
    expect(isForbidden(parseApiError(httpError(403)))).toBe(true);
  });

  it('flags network failures', () => {
    const config = { headers: new AxiosHeaders() };
    const info = parseApiError(new AxiosError('down', 'ERR_NETWORK', config));
    expect(info.network).toBe(true);
    expect(info.status).toBeNull();
  });
});

describe('describeApiError', () => {
  const withId = (id: string) => `(Mã tra cứu: ${id})`;

  it('shows the server message with its requestId', () => {
    const info = parseApiError(
      httpError(422, {
        error: { code: 'VALIDATION_FAILED', message: 'Sai.', requestId: 'r1' },
      }),
    );
    expect(describeApiError(info, 'Lỗi', withId)).toBe('Sai. (Mã tra cứu: r1)');
  });

  it('uses the app fallback text when the server gave no message', () => {
    expect(describeApiError(parseApiError(httpError(500)), 'Lỗi', withId)).toBe(
      'Lỗi',
    );
  });
});

describe('describeHttpError', () => {
  it('shows error.message of the BFF envelope with its requestId', () => {
    const error = httpError(403, {
      error: { code: 'FORBIDDEN', message: 'Thiếu quyền', requestId: 'r9' },
    });
    expect(describeHttpError(error)).toBe('Thiếu quyền (r9)');
  });

  it('falls back to the HTTP status', () => {
    expect(describeHttpError(httpError(502))).toBe('HTTP 502');
  });
});
