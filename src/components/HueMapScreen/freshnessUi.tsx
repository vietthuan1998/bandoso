import type { LayerFreshness } from '../../map/freshness';
import type { IconName } from './Icon';
import { COLORS } from './theme';

/**
 * Màu + icon dùng chung cho mọi nơi hiển thị "độ mới dữ liệu" (freshness) —
 * StatisticsScreen (3 ô trạng thái/donut) và FeatureDetailScreen (badge của
 * 1 đối tượng cụ thể) — để cùng 1 ngôn ngữ màu sắc xuyên suốt app thay vì mỗi
 * nơi tự định nghĩa lại.
 */
export const FRESHNESS_COLOR: Record<LayerFreshness, string> = {
  recent: COLORS.ok,
  stale: COLORS.warn,
  unknown: COLORS.offline,
};

export const FRESHNESS_ICON: Record<LayerFreshness, IconName> = {
  recent: 'checkCircle',
  stale: 'refresh',
  unknown: 'warning',
};
