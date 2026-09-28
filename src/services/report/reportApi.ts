import axios from 'axios';
import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { dcuAxios, dcuHeaders } from '../api/dcuClient';

/**
 * POST /reports/export (tài liệu mục 8, cần quyền report.export) — trả file
 * nhị phân, tên file trong Content-Disposition. PDF cố ý không có:
 * format "pdf" trả 501 NOT_IMPLEMENTED nên UI chỉ cho chọn xlsx/csv.
 */
export type ReportFormat = 'xlsx' | 'csv';
export type ReportKind = 'byWard' | 'byLayer' | 'byStatus';

export const REPORT_FORMATS: ReportFormat[] = ['xlsx', 'csv'];
export const REPORT_KINDS: ReportKind[] = ['byWard', 'byLayer', 'byStatus'];

/** Đủ 6 tham số của API. */
export type ReportExportRequest = {
  format: ReportFormat;
  report: ReportKind;
  collections: string[];
  /** Mã ĐVHC; rỗng = mọi phường xã. */
  wards: string[];
  /** yyyy-mm-dd; null = không giới hạn. */
  dateFrom: string | null;
  dateTo: string | null;
};

export const REPORT_MIME_TYPES: Record<ReportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

/**
 * Thân request: format + report luôn gửi; collections / wards / dateFrom /
 * dateTo chỉ gửi khi có giá trị — bỏ trống nghĩa là "tất cả" (cùng quy ước
 * với bộ lọc /statistics), không gửi mảng rỗng dễ bị hiểu thành "không gì cả".
 */
export function buildReportExportBody(
  request: ReportExportRequest,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    format: request.format,
    report: request.report,
  };
  if (request.collections.length) body.collections = request.collections;
  if (request.wards.length) body.wards = request.wards;
  if (request.dateFrom) body.dateFrom = request.dateFrom;
  if (request.dateTo) body.dateTo = request.dateTo;
  return body;
}

/** Tên file từ Content-Disposition (ưu tiên filename* UTF-8), bỏ ký tự đường dẫn. */
export function parseReportFilename(
  contentDisposition: string | null | undefined,
  fallback: string,
): string {
  let name: string | null = null;
  if (contentDisposition) {
    const encoded = /filename\*\s*=\s*(?:UTF-8'[^']*')?([^;]+)/i.exec(
      contentDisposition,
    );
    const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(contentDisposition);
    try {
      name = encoded
        ? decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''))
        : plain?.[1]?.trim() ?? null;
    } catch {
      name = plain?.[1]?.trim() ?? null;
    }
  }
  const safe = (name ?? '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return safe || fallback;
}

export type ReportFile = {
  filename: string;
  mimeType: string;
  /** Nội dung file mã hoá base64 để ghi ra đĩa. */
  base64: string;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export async function exportReport(
  request: ReportExportRequest,
): Promise<ReportFile> {
  const response = await dcuAxios.post<Blob>(
    `${DCU_API_BASE_URL}/reports/export`,
    buildReportExportBody(request),
    { headers: dcuHeaders(), responseType: 'blob' },
  );
  const today = new Date().toISOString().slice(0, 10);
  const contentType = response.headers['content-type'];
  return {
    filename: parseReportFilename(
      response.headers['content-disposition'],
      `bao-cao-${request.report}-${today}.${request.format}`,
    ),
    mimeType:
      typeof contentType === 'string' && contentType
        ? contentType.split(';')[0].trim()
        : REPORT_MIME_TYPES[request.format],
    base64: await blobToBase64(response.data),
  };
}

export type ReportErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'notImplemented'
  | 'error';

export function reportErrorKind(error: unknown): ReportErrorKind {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401) return 'unauthorized';
    if (status === 403) return 'forbidden';
    if (status === 501) return 'notImplemented';
  }
  return 'error';
}
