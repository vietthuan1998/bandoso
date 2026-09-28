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
 */
export function AccountScreen({ auth }: { auth: AuthGateState }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (auth.status !== 'authenticated') {
    return <LoginScreen onSubmit={auth.login} sessionExpired={auth.sessionExpired} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + SPACING.xl }]}>
      <Text style={styles.status}>{t('auth.loggedInStatus')}</Text>
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
