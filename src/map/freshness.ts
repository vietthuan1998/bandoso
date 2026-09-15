// Phân loại độ mới của 1 mốc thời gian cập nhật (date_updated thật từ
// Directus) — tách riêng khỏi statisticsOverview.ts vì được dùng ở CẢ 2 nơi:
// StatisticsScreen (tổng hợp theo collection) và FeatureDetailScreen (1 đối
// tượng cụ thể, mục "Chi tiết đối tượng"). Giữ chung 1 ngưỡng RECENT_DAYS để
// 2 màn hình không lệch nhau.

export type LayerFreshness = 'recent' | 'stale' | 'unknown';

export const RECENT_DAYS = 7;

/**
 * `maxUpdatedAt` = null/rỗng → "unknown" (không có mốc thời gian đáng tin
 * cậy). Có giá trị → so với hôm nay, ≤ RECENT_DAYS ngày là "recent", còn lại
 * là "stale".
 */
export function classifyFreshness(
  maxUpdatedAt: string | null | undefined,
): LayerFreshness {
  if (!maxUpdatedAt) return 'unknown';
  const diffDays = (Date.now() - new Date(maxUpdatedAt).getTime()) / 86_400_000;
  return diffDays <= RECENT_DAYS ? 'recent' : 'stale';
}
