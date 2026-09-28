import type { LayerFreshness } from '../../utils/freshness';
import type { IconName } from './Icon';
import { COLORS } from '../../constants/theme';

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
