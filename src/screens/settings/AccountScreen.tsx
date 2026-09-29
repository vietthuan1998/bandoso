import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { LoginScreen } from '../auth/LoginScreen';
import type { AuthGateState } from '../../hooks/useAuthGate';
import type { UserProfile } from '../../services/auth/authClient';
import {
  fetchCatalogWards,
  shortWardName,
  type CatalogWard,
} from '../../services/api/catalogApi';
import { Icon, type IconName } from '../../components/common/Icon';

/**
 * Tab "Tài khoản" — hệ thống dùng được khi chưa đăng nhập (bản đồ, dữ liệu
 * công khai qua /map/* và /catalog/* không cần token). Đăng nhập chỉ cần
 * cho dữ liệu nghiệp vụ/thống kê cá nhân hoá — không chặn App.tsx nữa.
 * Khi đã đăng nhập: thẻ hồ sơ + quyền truy cập từ /auth/me (tài liệu mục 10).
 */
export function AccountScreen({ auth }: { auth: AuthGateState }) {
  const insets = useSafeAreaInsets();

  if (auth.status !== 'authenticated') {
    return (
      <LoginScreen onSubmit={auth.login} sessionExpired={auth.sessionExpired} />
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + SPACING.lg,
          paddingBottom: insets.bottom + SPACING.xl,
        },
      ]}
    >
      <ProfileBadge profile={auth.profile} />
      {auth.profile ? <AccessCard profile={auth.profile} /> : null}
      <LogoutButton onPress={auth.logout} />
    </ScrollView>
  );
}

/** Chữ cái đầu của tên gọi (từ cuối trong họ tên tiếng Việt). */
function initialOf(profile: UserProfile | null): string | null {
  const source =
    profile?.fullName?.trim().split(/\s+/).pop() ?? profile?.username ?? '';
  return source ? source.charAt(0).toLocaleUpperCase('vi-VN') : null;
}

function ProfileBadge({ profile }: { profile: UserProfile | null }) {
  const { t } = useTranslation();
  const initial = initialOf(profile);
  const title =
    profile?.fullName || profile?.username || t('auth.loggedInStatus');
  return (
    <View style={styles.badge}>
      {/* Hình mờ ranh giới hành chính: thẻ công vụ gắn với địa bàn. */}
      <View style={styles.watermark} pointerEvents="none">
        <Icon name="wardBoundary" size={132} color="#ffffff" />
      </View>
      <View style={styles.badgeTop}>
        <View style={styles.avatar}>
          {initial ? (
            <Text style={styles.avatarText}>{initial}</Text>
          ) : (
            <Icon name="profile" size={30} color={COLORS.primaryDark} />
          )}
        </View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={2}>
            {title}
          </Text>
          {profile?.fullName && profile.username ? (
            <Text style={styles.username} numberOfLines={1}>
              {profile.username}
            </Text>
          ) : null}
        </View>
      </View>
      {profile?.unit ? (
        <View style={styles.unitRow}>
          <Icon name="cityHall" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.unit} numberOfLines={2}>
            {profile.unit}
          </Text>
        </View>
      ) : null}
      {profile?.roles.length ? (
        <View style={styles.roleRow}>
          {profile.roles.map(role => (
            <View key={role} style={styles.roleChip}>
              <Text style={styles.roleText}>
                {t(`account.roleNames.${role}`, { defaultValue: role })}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AccessCard({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  const wardScoped = profile.wardScope.type === 'ward';
  const [wards, setWards] = useState<CatalogWard[]>([]);
  useEffect(() => {
    if (!wardScoped) return undefined;
    let cancelled = false;
    fetchCatalogWards().then(
      items => {
        if (!cancelled) setWards(items);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [wardScoped]);

  // Hồ sơ tạm từ phản hồi đăng nhập chưa có allowedCollections — đợi /auth/me
  // thay vì hiện "0 lớp" gây hiểu nhầm.
  const profileLoaded = profile.id !== null;
  const layerValue = profileLoaded
    ? t('account.layerCount', { count: profile.allowedCollections.length })
    : '—';
  const wardNames = profile.wardScope.wardIds.map(code => {
    const ward = wards.find(item => item.code === code);
    return ward ? shortWardName(ward.name) : code;
  });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('account.accessTitle')}</Text>
      <AccessRow
        icon="pin"
        label={t('account.scope')}
        value={
          wardScoped
            ? t('scope.wards', { count: profile.wardScope.wardIds.length })
            : t('scope.all')
        }
        // Dãy chip phường bên dưới đã có đường kẻ riêng.
        last={wardScoped && wardNames.length > 0}
      />
      {wardScoped && wardNames.length > 0 ? (
        <View style={styles.wardChips}>
          {wardNames.map(name => (
            <View key={name} style={styles.wardChip}>
              <Text style={styles.wardChipText}>{name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <AccessRow
        icon="layers"
        label={t('account.visibleLayers')}
        value={layerValue}
        last
      />
    </View>
  );
}

function AccessRow({
  icon,
  label,
  value,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.accessRow, last ? styles.accessRowLast : null]}>
      <View style={styles.accessIcon}>
        <Icon name={icon} size={16} color={COLORS.primary} />
      </View>
      <Text style={styles.accessLabel}>{label}</Text>
      <Text style={styles.accessValue}>{value}</Text>
    </View>
  );
}

function LogoutButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.logoutButton,
        pressed ? styles.logoutButtonPressed : null,
      ]}
      accessibilityRole="button"
      testID="account-logout"
    >
      <Text style={styles.logoutText}>{t('auth.logoutButton')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: SPACING.lg, gap: SPACING.lg },

  badge: {
    overflow: 'hidden',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryDark,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  watermark: {
    position: 'absolute',
    right: -28,
    bottom: -30,
    opacity: 0.09,
  },
  badgeTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: COLORS.primaryDark },
  identity: { flex: 1, gap: 2 },
  name: { fontSize: 22, lineHeight: 27, fontWeight: '800', color: '#ffffff' },
  username: { fontSize: 13, color: 'rgba(255,255,255,0.72)' },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unit: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: {
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
  },
  roleText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },

  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  accessRowLast: { borderBottomWidth: 0 },
  accessIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eaf5fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessLabel: { flex: 1, fontSize: 13, color: COLORS.textMuted },
  accessValue: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  wardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingLeft: 42,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  wardChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
  },
  wardChipText: { fontSize: 12, color: COLORS.text },

  logoutButton: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.critical,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonPressed: { backgroundColor: '#fdecec' },
  logoutText: { color: COLORS.critical, fontSize: 15, fontWeight: '700' },
});
