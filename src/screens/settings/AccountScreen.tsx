import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { LoginScreen } from '../auth/LoginScreen';
import type { AuthGateState } from '../../hooks/useAuthGate';

/**
 * Tab "Tài khoản" — hệ thống dùng được khi chưa đăng nhập (bản đồ, dữ liệu
 * công khai qua /map/* và /catalog/* không cần token). Đăng nhập chỉ cần
 * cho dữ liệu nghiệp vụ/thống kê cá nhân hoá — không chặn App.tsx nữa.
 * Khi đã đăng nhập: hiển thị hồ sơ và phạm vi từ /auth/me (tài liệu mục 10).
 */
export function AccountScreen({ auth }: { auth: AuthGateState }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (auth.status !== 'authenticated') {
    return <LoginScreen onSubmit={auth.login} sessionExpired={auth.sessionExpired} />;
  }

  const profile = auth.profile;
  const rows: Array<{ key: string; label: string; value: string }> = profile
    ? [
        profile.fullName
          ? { key: 'fullName', label: t('account.fullName'), value: profile.fullName }
          : null,
        profile.username
          ? { key: 'username', label: t('account.username'), value: profile.username }
          : null,
        profile.unit
          ? { key: 'unit', label: t('account.unit'), value: profile.unit }
          : null,
        profile.roles.length
          ? {
              key: 'roles',
              label: t('account.roles'),
              value: profile.roles
                .map(role => t(`account.roleNames.${role}`, { defaultValue: role }))
                .join(', '),
            }
          : null,
        {
          key: 'scope',
          label: t('account.scope'),
          value:
            profile.wardScope.type === 'all'
              ? t('scope.all')
              : t('scope.wards', { count: profile.wardScope.wardIds.length }),
        },
      ].filter((row): row is { key: string; label: string; value: string } => !!row)
    : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top + SPACING.xl }]}>
      <Text style={styles.status}>{t('auth.loggedInStatus')}</Text>
      {rows.length > 0 ? (
        <View style={styles.card}>
          {rows.map((row, index) => (
            <View
              key={row.key}
              style={[styles.row, index === rows.length - 1 ? styles.rowLast : null]}
            >
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        onPress={auth.logout}
        style={styles.logoutButton}
        testID="account-logout"
      >
        <Text style={styles.logoutText}>{t('auth.logoutButton')}</Text>
      </Pressable>
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
  status: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 12, color: COLORS.textMuted },
  rowValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
  logoutButton: {
    minHeight: 44,
    minWidth: 140,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.critical,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  logoutText: { color: COLORS.surface, fontSize: 14, fontWeight: '700' },
});
