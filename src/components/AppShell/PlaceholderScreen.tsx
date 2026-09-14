import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../HueMapScreen/Icon';
import { COLORS, SPACING } from '../HueMapScreen/theme';

/**
 * Màn hình chờ cho các tab chưa có API/dữ liệu thật (Dữ liệu, Thống kê, Theo
 * dõi, Cá nhân — SCR-03/05/07.../13 trong mục 11.4 đặc tả kỹ thuật). Cố tình
 * KHÔNG dựng số liệu minh họa như trong mockup mota — mục 18.1.1 yêu cầu mọi
 * số liệu hiển thị phải truy xuất được từ Directus/BFF; widget chưa đủ hợp
 * đồng dữ liệu phải hiển thị "Chưa có dữ liệu", không hiển thị số liệu giả.
 */
export function PlaceholderScreen({
  icon,
  titleKey,
}: {
  icon: IconName;
  titleKey: string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + SPACING.xl }]}>
      <View style={styles.iconBadge}>
        <Icon name={icon} size={28} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{t(titleKey)}</Text>
      <View style={styles.noticeRow}>
        <Icon name="construction" size={14} color={COLORS.textFaint} />
        <Text style={styles.notice}>{t('comingSoon.title')}</Text>
      </View>
      <Text style={styles.message}>{t('comingSoon.message')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eaf5fc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7e6',
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginBottom: SPACING.md,
  },
  notice: { fontSize: 11, fontWeight: '700', color: COLORS.warningText },
  message: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
