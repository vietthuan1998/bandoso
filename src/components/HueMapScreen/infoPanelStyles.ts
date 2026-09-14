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

  // Field dạng mảng object (vd. "chu_so_huu" nhiều đồng sở hữu) — mỗi phần
  // tử hiển thị thành 1 thẻ con riêng thay vì gộp chung 1 dòng.
  listItemCard: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    gap: 2,
  },
  listItemIndex: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textFaint,
    marginBottom: 2,
  },
  listItemRow: { flexDirection: 'row', flexWrap: 'wrap' },
  listItemLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  listItemValue: { fontSize: 12, color: COLORS.text, flexShrink: 1 },

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
