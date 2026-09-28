import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { dcuAxios, dcuHeaders } from '../api/dcuClient';

export type WardTotal = { wardId: string; wardName: string; total: number };

/**
 * byWard của GET /statistics/summary (cần quyền statistics.read): tổng số đối
 * tượng mỗi phường xã, wardId = mã ĐVHC — cùng khoá với id/code của feature
 * trong /catalog/wards/geojson, nên ghép thẳng được để tô bản đồ.
 */
export async function fetchWardTotals(): Promise<WardTotal[]> {
  const response = await dcuAxios.get<{
    data?: {
      byWard?: Array<{ wardId: string | number; wardName: string; total: number }>;
    };
  }>(`${DCU_API_BASE_URL}/statistics/summary`, { headers: dcuHeaders() });
  return (response.data.data?.byWard ?? []).map(ward => ({
    wardId: String(ward.wardId),
    wardName: ward.wardName,
    total: Number(ward.total) || 0,
  }));
}

// Thang màu tuần tự nhạt -> đậm (ít -> nhiều đối tượng).
export const CHOROPLETH_COLORS = [
  '#dbeafe',
  '#93c5fd',
  '#3b82f6',
  '#1d4ed8',
  '#1e3a8a',
] as const;
// Phường xã không có đối tượng / không có trong số liệu: tách khỏi mức thấp nhất.
export const NO_DATA_COLOR = '#e5e7eb';

export type ChoroplethClass = { min: number; max: number; color: string };

/**
 * Chia các tổng > 0 thành tối đa `colors.length` mức theo phân vị (quantile):
 * số liệu giữa các phường chênh nhau rất lớn nên chia đều theo khoảng giá trị
 * sẽ dồn gần hết phường vào một màu. Mức trùng ngưỡng được gộp lại.
 */
export function buildChoroplethClasses(
  totals: number[],
  colors: readonly string[] = CHOROPLETH_COLORS,
): ChoroplethClass[] {
  const sorted = totals.filter(total => total > 0).sort((a, b) => a - b);
  if (!sorted.length) return [];

  const levels = colors.length;
  const uppers = Array.from(new Set(
    Array.from({ length: levels }, (_, i) =>
      sorted[Math.ceil(((i + 1) * sorted.length) / levels) - 1],
    ),
  ));

  return uppers.map((max, i) => ({
    min: i === 0 ? sorted[0] : uppers[i - 1] + 1,
    max,
    // Ít mức hơn số màu thì trải đều trên thang, luôn kết thúc ở màu đậm nhất.
    color:
      colors[
        uppers.length === 1
          ? levels - 1
          : Math.round((i * (levels - 1)) / (uppers.length - 1))
      ],
  }));
}

export function colorForTotal(
  total: number,
  classes: ChoroplethClass[],
): string {
  if (total <= 0) return NO_DATA_COLOR;
  return classes.find(cls => total <= cls.max)?.color ?? NO_DATA_COLOR;
}

/** Biểu thức 'fill-color' ghép màu theo mã ĐVHC (thuộc tính `code` của feature). */
export function buildWardFillColor(
  wardTotals: WardTotal[],
  classes: ChoroplethClass[],
): unknown {
  // 'match' của MapLibre báo lỗi khi nhãn trùng nhau -> gộp theo mã ĐVHC.
  const totalById = new Map<string, number>();
  for (const ward of wardTotals) {
    totalById.set(ward.wardId, (totalById.get(ward.wardId) ?? 0) + ward.total);
  }
  if (!totalById.size) return NO_DATA_COLOR;
  return [
    'match',
    ['to-string', ['get', 'code']],
    ...Array.from(totalById).flatMap(([wardId, total]) => [
      wardId,
      colorForTotal(total, classes),
    ]),
    NO_DATA_COLOR,
  ];
}
