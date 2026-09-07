import { StyleSheet } from 'react-native';
import { COLORS } from './theme';

export const infoPanelStyles = StyleSheet.create({
  iconRow: { flexDirection: 'row', gap: 10 },
  iconGlyph: { fontSize: 17, width: 20, textAlign: 'center' },
  iconRowBody: { flex: 1, gap: 2 },
  iconRowLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  value: { fontSize: 12, color: COLORS.text, lineHeight: 17 },
  hint: {
    fontSize: 11,
    fontStyle: 'italic',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  strong: { fontSize: 13, fontWeight: '700', color: COLORS.text },

  kvRow: { flexDirection: 'row', gap: 6 },
  kvLabel: { width: 90, color: COLORS.textMuted, fontSize: 12 },
  kvValue: { flex: 1, fontSize: 12, color: COLORS.text },

  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: COLORS.textFaint,
    marginBottom: 3,
  },
  detailValue: { fontSize: 12, lineHeight: 18, color: COLORS.text },

  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { flex: 1, fontSize: 12, color: COLORS.text, lineHeight: 17 },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.warningBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  noticeIcon: { fontSize: 13 },
  noticeText: { fontSize: 11, fontWeight: '600', color: COLORS.warningText },
});
