import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchDataOverview, type DataOverview } from '../../services/statistics/dataOverview';
import {
  describeApiError,
  isUnauthorized,
  parseApiError,
} from '../../services/api/apiError';
import { Icon } from '../common/Icon';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export function DataOverviewPanel({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<DataOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tải lại mỗi lần mở: số liệu theo phiên đăng nhập hiện tại (cần quyền
  // statistics.read) và do server chốt tại thời điểm xem.
  useEffect(() => {
    if (!visible) return;
    let disposed = false;
    setLoading(true);
    setError(null);
    fetchDataOverview()
      .then(result => {
        if (!disposed) setOverview(result);
      })
      .catch(reason => {
        if (disposed) return;
        const info = parseApiError(reason);
        setOverview(null);
        setError(
          isUnauthorized(info)
            ? t('statistics.needLogin')
            : describeApiError(info, t('dataOverview.error'), id =>
                t('common.requestId', { id }),
              ),
        );
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [visible, t]);

  if (!visible) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="statistics" size={14} color="#ffffff" />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {t('dataOverview.title')}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.closeMenu')}
          hitSlop={10}
          style={styles.closeButton}
        >
          <Icon name="close" size={16} color={COLORS.textMuted} />
        </Pressable>
      </View>

      {loading && !overview ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('dataOverview.loading')}</Text>
        </View>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : overview ? (
        <ScrollView style={styles.body}>
          <View style={styles.tileRow}>
            <View style={styles.tile}>
              <View style={[styles.tileIcon, styles.tileIconObjects]}>
                <Icon name="database" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.tileValue}>
                {overview.total.toLocaleString('vi-VN')}
              </Text>
              <Text style={styles.tileLabel}>
                {t('dataOverview.totalObjects')}
              </Text>
            </View>
            <View style={styles.tile}>
              <View style={[styles.tileIcon, styles.tileIconUnknown]}>
                <Icon name="pin" size={16} color={COLORS.warn} />
              </View>
              <Text style={styles.tileValue}>
                {overview.unknownWard.toLocaleString('vi-VN')}
              </Text>
              <Text style={styles.tileLabel}>
                {t('dataOverview.unknownWard')}
              </Text>
            </View>
          </View>

          {overview.notes.length > 0 ? (
            <View style={styles.notesBox}>
              {overview.notes.map(note => (
                <Text key={note} style={styles.notesText}>
                  • {note}
                </Text>
              ))}
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>
            {t('dataOverview.groupsSectionTitle')}
          </Text>
          {overview.groups.map(group => (
            <View key={group.id} style={styles.group}>
              <View style={styles.groupHeader}>
                <Icon name={group.icon} size={15} color={COLORS.textMuted} />
                <Text style={styles.groupLabel}>
                  {group.label ?? t('dataOverview.otherGroup')}
                </Text>
              </View>
              {group.layers.map(layer => (
                <View key={layer.collection} style={styles.layerRow}>
                  <Text style={styles.layerLabel} numberOfLines={1}>
                    {layer.label}
                  </Text>
                  <Text style={styles.groupCount}>
                    {layer.count.toLocaleString('vi-VN')}
                  </Text>
                </View>
              ))}
            </View>
          ))}

          <Text style={styles.footerNote}>{t('dataOverview.footerNote')}</Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.md,
    maxHeight: '72%',
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#17263c',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  headerIcon: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.text },
  body: { flexShrink: 1 },
  closeButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef3f7',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  errorText: {
    fontSize: 12,
    color: COLORS.critical,
    paddingVertical: SPACING.sm,
  },
  tileRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  tile: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  tileIconObjects: { backgroundColor: '#eaf5fc' },
  tileIconUnknown: { backgroundColor: '#fff6e5' },
  tileValue: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  tileLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: SPACING.xs,
  },
  notesBox: {
    backgroundColor: '#fff8e6',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 2,
  },
  notesText: { fontSize: 11, lineHeight: 15, color: COLORS.warningText },
  group: {
    paddingVertical: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  groupLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.text },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: SPACING.lg + 7,
    paddingVertical: 3,
  },
  layerLabel: { flex: 1, fontSize: 12, color: COLORS.textMuted },
  groupCount: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  footerNote: {
    fontSize: 10,
    color: COLORS.textFaint,
    marginTop: SPACING.sm,
    lineHeight: 14,
  },
});
