import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { dcuAxios, dcuHeaders } from '../api/dcuClient';
import {
  isForbidden,
  isUnauthorized,
  parseApiError,
} from '../api/apiError';
import type { TrendPoint } from './statisticsOverview';

/**
 * API thống kê của BFF (tài liệu mục 7, cần quyền statistics.read). Server là
 * nguồn sự thật: client không tự tính lại, không cộng bù, và giữ nguyên null
 * (null = chưa đo được, KHÔNG phải 0).
 */

export type StatisticsFilters = {
  collections?: string[];
  /** Mã ĐVHC (wardId / code), không phải tên. */
  wards?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type StatisticsTotals = {
  total: number;
  completed: number | null;
  inProgress: number | null;
  error: number | null;
  overdue: number | null;
  /** Bản ghi không quy được về phường xã nào — bắt buộc hiển thị. */
  unknownWard: number;
};

export type StatisticsByWard = {
  wardId: string;
  wardName: string;
  total: number;
  completed: number | null;
  error: number | null;
  overdue: number | null;
  /** Chỉ khác null khi lớp có kế hoạch số hoá làm mẫu số — hiện chưa lớp nào có. */
  completionRatio: number | null;
  lastUpdatedAt: string | null;
};

export type StatisticsSummary = {
  totals: StatisticsTotals;
  byLayer: Array<{ collection: string; label: string; count: number }>;
  byStatus: Array<{ status: string; label: string; count: number }>;
  byWard: StatisticsByWard[];
  trend: Array<{ bucket: string; count: number }>;
};

export type StatisticsSummaryResult = {
  summary: StatisticsSummary;
  /** Giải thích phần lệch số liệu — bắt buộc hiển thị khi có. */
  notes: string[];
};

export type StatisticsBucket = 'day' | 'month' | 'quarter';

/** Khoá logic của chiều nhóm — không phải tên cột. */
export type StatisticsDimension = 'ward' | 'status' | 'unit' | 'updatedAt';

export type StatisticsGroupItem = {
  /** Giá trị để drill-down (với dimension=ward: mã ĐVHC dùng cho ?wards=). */
  key: string;
  label: string;
  count: number;
  /** Tỷ trọng count / total (0..1) — không phải tỷ lệ hoàn thành. */
  ratio: number;
};

export type StatisticsGroupResult = {
  dimension: StatisticsDimension;
  /** Chỉ để tham khảo; lớp không có trường phường xã trả "(chỉ mục địa bàn)". */
  field: string;
  total: number;
  unknownCount: number;
  items: StatisticsGroupItem[];
};

export type StatisticsMeasure = {
  field: string;
  label: string;
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
};

type Envelope<T> = { data: T; meta?: { notes?: string[] } };

/** Tham số danh sách phân tách bằng dấu phẩy (?wards=19900,19858). */
export function buildStatisticsParams(
  filters: StatisticsFilters,
  extra: Record<string, string> = {},
): Record<string, string> {
  const params: Record<string, string> = { ...extra };
  if (filters.collections?.length) {
    params.collections = filters.collections.join(',');
  }
  if (filters.wards?.length) params.wards = filters.wards.join(',');
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  return params;
}

// Endpoint theo từng collection đã có collectionKey trên đường dẫn: chỉ gửi
// wards / dateFrom / dateTo.
function collectionScopedParams(
  filters: StatisticsFilters,
  extra: Record<string, string>,
): Record<string, string> {
  return buildStatisticsParams({ ...filters, collections: undefined }, extra);
}

async function getStatistics<T>(
  path: string,
  params: Record<string, string>,
): Promise<Envelope<T>> {
  const response = await dcuAxios.get<Envelope<T>>(
    `${DCU_API_BASE_URL}/statistics${path}`,
    { params, headers: dcuHeaders() },
  );
  return response.data;
}

export async function fetchStatisticsSummary(
  filters: StatisticsFilters,
): Promise<StatisticsSummaryResult> {
  const body = await getStatistics<StatisticsSummary>(
    '/summary',
    buildStatisticsParams(filters),
  );
  return {
    summary: {
      ...body.data,
      byLayer: body.data.byLayer ?? [],
      byStatus: body.data.byStatus ?? [],
      byWard: (body.data.byWard ?? []).map(ward => ({
        ...ward,
        wardId: String(ward.wardId),
      })),
      trend: body.data.trend ?? [],
    },
    notes: body.meta?.notes ?? [],
  };
}

export async function fetchStatisticsTrend(
  collectionKey: string,
  bucket: StatisticsBucket,
  filters: StatisticsFilters,
): Promise<Array<{ bucket: string; count: number }>> {
  const body = await getStatistics<Array<{ bucket: string; count: number }>>(
    `/${encodeURIComponent(collectionKey)}/trend`,
    collectionScopedParams(filters, { bucket }),
  );
  return body.data ?? [];
}

/** `fields` phải thuộc layer.dimensions.measureFields, nếu không API trả 422. */
export async function fetchStatisticsMeasures(
  collectionKey: string,
  fields: string[],
  filters: StatisticsFilters,
): Promise<StatisticsMeasure[]> {
  const body = await getStatistics<StatisticsMeasure[]>(
    `/${encodeURIComponent(collectionKey)}/measures`,
    collectionScopedParams(filters, { fields: fields.join(',') }),
  );
  return body.data ?? [];
}

export async function fetchStatisticsGroups(
  collectionKey: string,
  dimension: StatisticsDimension,
  filters: StatisticsFilters,
): Promise<StatisticsGroupResult> {
  const body = await getStatistics<StatisticsGroupResult>(
    `/${encodeURIComponent(collectionKey)}/groups`,
    collectionScopedParams(filters, { dimension }),
  );
  return {
    ...body.data,
    items: (body.data.items ?? []).map(item => ({
      ...item,
      key: String(item.key),
    })),
  };
}

export type StatisticsErrorKind = 'unauthorized' | 'forbidden' | 'error';

/** Phân loại theo error.code (tài liệu mục 2), không theo câu chữ. */
export function statisticsErrorKind(error: unknown): StatisticsErrorKind {
  const info = parseApiError(error);
  if (isUnauthorized(info)) return 'unauthorized';
  if (isForbidden(info)) return 'forbidden';
  return 'error';
}

/**
 * Nhãn trục cho điểm xu hướng. `bucket` có thể là ngày (2026-09-28), tháng
 * (2026-09 hoặc ngày đầu tháng) hay quý (2026-Q3); không nhận ra thì giữ nguyên.
 */
export function formatTrendBucket(bucket: string, kind: StatisticsBucket): string {
  const quarter = /^(\d{4})-?Q([1-4])$/i.exec(bucket);
  if (quarter) return `Q${quarter[2]}/${quarter[1]}`;
  const date = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(bucket);
  if (!date) return bucket;
  const [, year, month, day] = date;
  if (kind === 'quarter') {
    return `Q${Math.floor((Number(month) - 1) / 3) + 1}/${year}`;
  }
  if (kind === 'month' || !day) return `${month}/${year}`;
  return `${day}/${month}`;
}

export function toTrendPoints(
  points: Array<{ bucket: string; count: number }>,
  kind: StatisticsBucket,
): TrendPoint[] {
  return points.map(point => ({
    date: point.bucket,
    label: formatTrendBucket(point.bucket, kind),
    count: Number(point.count) || 0,
  }));
}
