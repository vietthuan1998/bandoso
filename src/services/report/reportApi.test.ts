jest.mock('../api/dcuClient', () => ({
  dcuAxios: { post: jest.fn() },
  dcuHeaders: jest.fn(() => ({ Authorization: 'Bearer access-test' })),
}));

import { AxiosError, AxiosHeaders } from 'axios';
import { dcuAxios } from '../api/dcuClient';
import {
  buildReportExportBody,
  exportReport,
  parseReportFilename,
  reportErrorKind,
} from './reportApi';

const mockedPost = dcuAxios.post as jest.Mock;

// Jest (môi trường node) không có FileReader của React Native.
class FakeFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: { base64: string }) {
    this.result = `data:application/octet-stream;base64,${blob.base64}`;
    this.onload?.();
  }
}
(globalThis as unknown as { FileReader: unknown }).FileReader = FakeFileReader;

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', String(status), config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: {},
  });
}

describe('buildReportExportBody', () => {
  it('sends all 6 parameters when they are set', () => {
    expect(
      buildReportExportBody({
        format: 'csv',
        report: 'byStatus',
        collections: ['thua_dat'],
        wards: ['19858'],
        dateFrom: '2026-01-01',
        dateTo: '2026-09-28',
      }),
    ).toEqual({
      format: 'csv',
      report: 'byStatus',
      collections: ['thua_dat'],
      wards: ['19858'],
      dateFrom: '2026-01-01',
      dateTo: '2026-09-28',
    });
  });

  it('always sends format + report and leaves unset scope out (= all)', () => {
    expect(
      buildReportExportBody({
        format: 'xlsx',
        report: 'byWard',
        collections: [],
        wards: [],
        dateFrom: null,
        dateTo: null,
      }),
    ).toEqual({ format: 'xlsx', report: 'byWard' });
  });
});

describe('parseReportFilename', () => {
  it('prefers the UTF-8 filename* and strips path characters', () => {
    expect(
      parseReportFilename(
        "attachment; filename=\"bao-cao.xlsx\"; filename*=UTF-8''b%C3%A1o%20c%C3%A1o%2Fth%E1%BB%ADa.xlsx",
        'x.xlsx',
      ),
    ).toBe('báo cáo_thửa.xlsx');
    expect(parseReportFilename('attachment; filename="bao-cao-byWard.csv"', 'x.csv')).toBe(
      'bao-cao-byWard.csv',
    );
    expect(parseReportFilename(undefined, 'fallback.xlsx')).toBe('fallback.xlsx');
  });
});

describe('exportReport', () => {
  it('POSTs the body as a blob request and returns the file from the response', async () => {
    mockedPost.mockResolvedValue({
      data: { base64: 'UEsDBBQ=' },
      headers: {
        'content-disposition': 'attachment; filename="bao-cao.xlsx"',
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

    const file = await exportReport({
      format: 'xlsx',
      report: 'byWard',
      collections: ['thua_dat'],
      wards: [],
      dateFrom: null,
      dateTo: '2026-09-28',
    });

    const [url, body, config] = mockedPost.mock.calls[0];
    expect(url).toMatch(/\/reports\/export$/);
    expect(body).toEqual({
      format: 'xlsx',
      report: 'byWard',
      collections: ['thua_dat'],
      dateTo: '2026-09-28',
    });
    expect(config).toEqual({
      headers: { Authorization: 'Bearer access-test' },
      responseType: 'blob',
    });
    expect(file).toEqual({
      filename: 'bao-cao.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: 'UEsDBBQ=',
    });
  });
});

describe('reportErrorKind', () => {
  it('maps login, permission and not-implemented (pdf) errors', () => {
    expect(reportErrorKind(httpError(401))).toBe('unauthorized');
    expect(reportErrorKind(httpError(403))).toBe('forbidden');
    expect(reportErrorKind(httpError(501))).toBe('notImplemented');
    expect(reportErrorKind(new Error('offline'))).toBe('error');
  });
});
