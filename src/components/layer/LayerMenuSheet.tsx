import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMapRegistry } from '../../services/map/mapRegistry';
import { Icon, type IconName } from '../common/Icon';
import { LeftSheet } from '../common/LeftSheet';
import { COLORS, SPACING } from '../../constants/theme';

const ADMIN_GROUP_ID = 'admin';

export function LayerMenuSheet({
  visible,
  onClose,
  loading,
  error,
  cityVisible,
  citySelected,
  allWardsVisible,
  selectedWardId,
  onToggleCity,
  onSelectCity,
  onToggleAllWards,
  onViewAllWards,
  mvtLayersVisible,
  onToggleMvtLayer,
}: {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  cityVisible: boolean;
  citySelected: boolean;
  allWardsVisible: boolean;
  selectedWardId: string | null;
  onToggleCity: (visible: boolean) => void;
  onSelectCity: () => void;
  onToggleAllWards: (visible: boolean) => void;
  onViewAllWards: () => void;
  mvtLayersVisible: Record<string, boolean>;
  onToggleMvtLayer: (id: string, visible: boolean) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const registry = useMapRegistry();
  // Nhóm "Hành chính" mở sẵn để thấy ngay lớp thành phố/phường xã như trước.
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set([ADMIN_GROUP_ID]),
  );
  const toggleGroup = (id: string) =>
    setOpenGroups(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <LeftSheet visible={visible} onClose={onClose}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <Text style={styles.title} numberOfLines={1}>
          {t('menu.title')}
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.closeMenu')}
        >
          <Text style={styles.close}>{t('common.close')}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + SPACING.xl },
        ]}
      >
        <LayerGroup
          icon="cityHall"
          label={t('menu.administrative')}
          visibleCount={Number(cityVisible) + Number(allWardsVisible)}
          totalCount={2}
          expanded={openGroups.has(ADMIN_GROUP_ID)}
          onToggleExpanded={() => toggleGroup(ADMIN_GROUP_ID)}
        >
          {loading ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.statusText}>{t('common.loading')}</Text>
            </View>
          ) : error ? (
            <Text style={[styles.statusRow, styles.errorText]}>{error}</Text>
          ) : (
            <>
              <LayerRow
                icon="city"
                color={COLORS.primaryDark}
                label={t('menu.city')}
                checked={cityVisible}
                highlighted={citySelected}
                onToggle={onToggleCity}
                onPressLabel={onSelectCity}
              />
              <LayerRow
                icon="wardBoundary"
                color={COLORS.primaryDark}
                label={t('menu.wards')}
                checked={allWardsVisible}
                highlighted={selectedWardId === null}
                onToggle={onToggleAllWards}
                onPressLabel={onViewAllWards}
              />
            </>
          )}
        </LayerGroup>

        {registry.status === 'loading' && registry.layers.length === 0 ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.statusText}>{t('common.loading')}</Text>
          </View>
        ) : null}
        {registry.status === 'error' ? (
          <View style={styles.statusRow}>
            <Text style={[styles.errorText, styles.statusFill]}>
              {t('map.loadError')}
            </Text>
            <Pressable onPress={registry.reload} hitSlop={8}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Nhóm + lớp MVT đều lấy từ registry (/map/layers, /catalog/layer-groups). */}
        {registry.groups.map(mvtGroup => {
          const layers = registry.layers.filter(
            layer => layer.groupKey === mvtGroup.key,
          );
          const groupKey = `mvt-${mvtGroup.key}`;
          return (
            <LayerGroup
              key={groupKey}
              icon={mvtGroup.icon}
              label={mvtGroup.label}
              visibleCount={
                layers.filter(layer => mvtLayersVisible[layer.id]).length
              }
              totalCount={layers.length}
              expanded={openGroups.has(groupKey)}
              onToggleExpanded={() => toggleGroup(groupKey)}
            >
              {layers.map(mvtLayer => {
                const checked = mvtLayersVisible[mvtLayer.id] ?? false;
                return (
                  <LayerRow
                    key={mvtLayer.id}
                    icon={mvtLayer.icon}
                    color={mvtLayer.color}
                    label={mvtLayer.label}
                    checked={checked}
                    onToggle={value => onToggleMvtLayer(mvtLayer.id, value)}
                    onPressLabel={() => onToggleMvtLayer(mvtLayer.id, !checked)}
                  />
                );
              })}
            </LayerGroup>
          );
        })}
      </ScrollView>
    </LeftSheet>
  );
}

function LayerGroup({
  icon,
  label,
  expanded,
  onToggleExpanded,
  children,
}: {
  icon: IconName;
  label: string;
  visibleCount: number;
  totalCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Pressable
        style={styles.groupHeader}
        onPress={onToggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Icon name={icon} size={18} color={COLORS.textMuted} />
        <Text style={styles.groupLabel}>{label}</Text>
        <Icon
          name={expanded ? 'chevronUp' : 'chevronDown'}
          size={22}
          color={COLORS.textMuted}
        />
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

function LayerRow({
  icon,
  color,
  label,
  checked,
  highlighted = false,
  disabled = false,
  onToggle,
  onPressLabel,
}: {
  icon: IconName;
  color: string;
  label: string;
  checked: boolean;
  highlighted?: boolean;
  disabled?: boolean;
  onToggle: (value: boolean) => void;
  onPressLabel: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPressLabel} style={styles.rowLabelWrap}>
        <View style={styles.rowIcon}>
          <Icon name={icon} size={18} color={color} />
        </View>
        <Text
          style={[
            styles.rowLabel,
            highlighted ? styles.rowLabelActive : null,
            disabled ? styles.rowLabelDisabled : null,
          ]}
        >
          {label}
        </Text>
      </Pressable>
      <Switch
        value={checked}
        disabled={disabled}
        onValueChange={onToggle}
        trackColor={{ false: '#d7e1ea', true: COLORS.primary }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.text },
  close: { color: COLORS.primary, fontWeight: '600' },
  // LeftSheet cao hết màn hình nên ScrollView phải giãn hết phần còn lại
  // (flex: 1) để cuộn đúng trong chiều cao cố định của panel.
  scroll: { flex: 1 },
  body: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  group: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  groupLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'uppercase',
  },
  groupCount: { fontSize: 12, color: COLORS.textFaint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingLeft: 22,
  },
  rowLabelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowIcon: { marginRight: 10 },
  rowLabel: { flex: 1, fontSize: 14, color: COLORS.text },
  rowLabelActive: { color: COLORS.primaryDark, fontWeight: '600' },
  rowLabelDisabled: { color: COLORS.textFaint },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingLeft: 22,
  },
  statusText: { fontSize: 12, color: COLORS.textMuted },
  statusFill: { flex: 1 },
  errorText: { fontSize: 12, color: COLORS.critical },
  retry: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
});
