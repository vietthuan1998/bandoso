import { Dimensions } from 'react-native';

// Bảng màu theo "Design system tham chiếu" trong mota/README.md
export const COLORS = {
  primary: '#0878bd',
  primaryDark: '#075a9b',
  background: '#f5f8fb',
  surface: '#ffffff',
  text: '#17263c',
  textMuted: '#526174',
  textFaint: '#718596',
  border: '#d5e1eb',
  borderSoft: '#e2e9ef',
  backdrop: 'rgba(16, 47, 76, 0.45)',
  ok: '#16a34a',
  warn: '#f59e0b',
  critical: '#dc2626',
  offline: '#64748b',
  accent: '#8b5cf6',
  accentOrange: '#f97316',
  warningBg: '#fff7e6',
  warningText: '#8a5a00',
} as const;

export const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const CHART_WIDTH =
  Dimensions.get('window').width -
  (SPACING.lg + SPACING.md) * 2 -
  SPACING.md * 2;
