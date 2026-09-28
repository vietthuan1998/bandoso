import {
  MaterialDesignIcons,
  type MaterialDesignIconsIconName,
} from '@react-native-vector-icons/material-design-icons/static';

// Tên icon theo ngữ nghĩa của app → tên glyph trong bộ Material Design Icons
// (https://pictogrammers.com/library/mdi/). Màn hình chỉ dùng tên ngữ nghĩa để
// đổi bộ icon/glyph tại một chỗ; `satisfies` bắt lỗi ngay khi glyph bị đổi tên
// hoặc bị xoá ở bản MDI mới.
const GLYPHS = {
  close: 'close',
  search: 'magnify',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  chevronRight: 'chevron-right',
  chevronLeft: 'chevron-left',
  info: 'information-outline',
  pin: 'map-marker',
  language: 'web',
  check: 'check',
  layers: 'layers',

  map: 'map',
  template: 'compare',
  database: 'database',
  statistics: 'chart-bar',
  tracking: 'access-point',
  profile: 'account-circle',
  construction: 'hammer-wrench',

  cityHall: 'bank',
  area: 'ruler-square',
  population: 'account-group',
  city: 'city-variant-outline',
  wardBoundary: 'vector-polygon',
  publicInfo: 'bullhorn-outline',
  investment: 'briefcase-outline',
  auction: 'gavel',
  landscape: 'image-filter-hdr',
  environment: 'leaf',
  buildings: 'domain',
  sensor: 'access-point-network',
  science: 'flask-outline',
  handshake: 'handshake-outline',
  wind: 'weather-windy',
  rain: 'weather-pouring',
  waterLevel: 'waves',

  checkCircle: 'check-circle',
  antenna: 'antenna',

  locate: 'crosshairs-gps',
  refresh: 'refresh',
  warning: 'alert-outline',
  calendar: 'calendar-month',
  share: 'share-variant',
  status: 'clipboard-text-outline',
} as const satisfies Record<string, MaterialDesignIconsIconName>;

export type IconName = keyof typeof GLYPHS;

export function Icon({
  name,
  size = 18,
  color = '#17263c',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <MaterialDesignIcons name={GLYPHS[name]} size={size} color={color} />;
}
