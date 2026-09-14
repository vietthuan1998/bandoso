import { useEffect, useRef, useState } from 'react';
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
import { MVT_GROUPS, MVT_LAYERS } from '../../map/mvtLayers';
import { Icon } from './Icon';
import { LayersGlyph } from './LayersGlyph';
import { LeftSheet } from './LeftSheet';
import { COLORS, RADIUS, SPACING } from './theme';

type LayerGroup = {
  id: string;
  titleKey: string;
  color: string;
  itemKeys: string[];
};

const LAYER_GROUPS: LayerGroup[] = [
  {
    id: 'public',
    titleKey: 'menu.public',
    color: '#1b9b52',
    itemKeys: ['menu.auction'],
  },
  // {
  //   id: 'planning',
  //   titleKey: 'menu.planning',
  //   color: '#0878bd',
  //   itemKeys: [
  //     'menu.generalPlanning',
  //     'menu.zoningPlanning',
  //     'menu.detailedPlanning',
  //     'menu.landUsePlanning',
  //   ],
  // },
  // {
  //   id: 'status',
  //   titleKey: 'menu.status',
  //   color: '#68778a',
  //   itemKeys: ['menu.landUseStatus', 'menu.populationStatus'],
  // },
  // {
  //   id: 'infrastructure',
  //   titleKey: 'menu.infrastructure',
  //   color: '#8b5cf6',
  //   itemKeys: ['menu.transportInfrastructure', 'menu.technicalInfrastructure'],
  // },
  // {
  //   id: 'specialized',
  //   titleKey: 'menu.specialized',
  //   color: '#e78018',
  //   itemKeys: ['menu.environment', 'menu.cultureTourism'],
  // },
];

export function LayerMenuSheet({
  visible,
  onClose,
  loading,
  error,
  cityVisible,
  citySelected,
  allWardsVisible,
  selectedWardId,
  projectLayerVisible,
  onToggleCity,
  onSelectCity,
  onToggleAllWards,
  onViewAllWards,
  onToggleProjectLayer,
  onActivateProjectLayer,
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
  projectLayerVisible: boolean;
  onToggleCity: (visible: boolean) => void;
  onSelectCity: () => void;
  onToggleAllWards: (visible: boolean) => void;
  onViewAllWards: () => void;
  onToggleProjectLayer: (visible: boolean) => void;
  onActivateProjectLayer: () => void;
  mvtLayersVisible: Record<string, boolean>;
  onToggleMvtLayer: (id: string, visible: boolean) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const notifyUpdating = () => {
    setNotice(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setNotice(false), 2000);
  };

  const toggleGroup = (id: string) =>
    setOpenGroups(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <LeftSheet visible={visible} onClose={onClose}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <LayersGlyph size={16} color={COLORS.primaryDark} />
        <Text style={styles.headerTitle}>{t('menu.title')}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.closeMenu')}
        >
          <Icon name="close" size={18} color={COLORS.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING.xl },
        ]}
      >
        <GroupHeader
          title={t('menu.administrative')}
          color={COLORS.primaryDark}
          open
          onClick={() => {}}
        />
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <ToggleRow
              label={t('menu.city')}
              checked={cityVisible}
              highlighted={citySelected}
              onToggle={onToggleCity}
              onPressLabel={onSelectCity}
            />
            <ToggleRow
              label={t('menu.wards')}
              checked={allWardsVisible}
              highlighted={selectedWardId === null}
              onToggle={onToggleAllWards}
              onPressLabel={onViewAllWards}
            />
          </>
        )}

        {LAYER_GROUPS.map(group => {
          const open = openGroups.has(group.id);
          return (
            <View key={group.id} style={styles.group}>
              <GroupHeader
                title={t(group.titleKey)}
                color={group.color}
                open={open}
                onClick={() => toggleGroup(group.id)}
              />
              {open ? (
                <View style={styles.groupBody}>
                  {group.id === 'public' ? (
                    <ToggleRow
                      label={t('menu.investmentProjects')}
                      checked={projectLayerVisible}
                      highlighted={projectLayerVisible}
                      onToggle={onToggleProjectLayer}
                      onPressLabel={onActivateProjectLayer}
                    />
                  ) : null}
                  {group.itemKeys.map(itemKey => (
                    <Pressable
                      key={itemKey}
                      onPress={notifyUpdating}
                      style={styles.placeholderRow}
                    >
                      <View style={styles.placeholderBox} />
                      <Text style={styles.placeholderLabel}>{t(itemKey)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={styles.group}>
          <GroupHeader
            title={t('mvt.sectionTitle')}
            color="#c026d3"
            open={openGroups.has('mvt-root')}
            onClick={() => toggleGroup('mvt-root')}
          />
          {openGroups.has('mvt-root') ? (
            <View style={styles.groupBody}>
              <Text style={styles.mvtHint}>{t('mvt.hint')}</Text>
              {MVT_GROUPS.map(mvtGroup => {
                const subGroupKey = `mvt-${mvtGroup.id}`;
                const subOpen = openGroups.has(subGroupKey);
                const layers = MVT_LAYERS.filter(
                  layer => layer.groupId === mvtGroup.id,
                );
                return (
                  <View key={mvtGroup.id} style={styles.mvtSubGroup}>
                    <GroupHeader
                      title={t(mvtGroup.labelKey)}
                      color={mvtGroup.color}
                      open={subOpen}
                      onClick={() => toggleGroup(subGroupKey)}
                    />
                    {subOpen ? (
                      <View style={styles.groupBody}>
                        {layers.map(mvtLayer => (
                          <ToggleRow
                            key={mvtLayer.id}
                            label={t(mvtLayer.labelKey)}
                            checked={mvtLayersVisible[mvtLayer.id] ?? false}
                            highlighted={mvtLayersVisible[mvtLayer.id] ?? false}
                            onToggle={value =>
                              onToggleMvtLayer(mvtLayer.id, value)
                            }
                            onPressLabel={() =>
                              onToggleMvtLayer(
                                mvtLayer.id,
                                !(mvtLayersVisible[mvtLayer.id] ?? false),
                              )
                            }
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {notice ? (
        <View style={styles.toast}>
          <Icon name="info" size={15} color="#8ed4ff" />
          <Text style={styles.toastText}>{t('menu.updating')}</Text>
        </View>
      ) : null}
    </LeftSheet>
  );
}

function GroupHeader({
  title,
  color,
  open,
  onClick,
}: {
  title: string;
  color: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <Pressable onPress={onClick} style={styles.groupHeader}>
      <View style={[styles.groupDot, { backgroundColor: color }]} />
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={open ? styles.chevronOpen : undefined}>
        <Icon name="chevronDown" size={14} color={COLORS.textFaint} />
      </View>
    </Pressable>
  );
}

function ToggleRow({
  label,
  checked,
  highlighted,
  onToggle,
  onPressLabel,
}: {
  label: string;
  checked: boolean;
  highlighted: boolean;
  onToggle: (value: boolean) => void;
  onPressLabel: () => void;
}) {
  return (
    <View
      style={[styles.toggleRow, highlighted ? styles.toggleRowActive : null]}
    >
      <Pressable onPress={onPressLabel} style={styles.toggleLabelWrap}>
        <Text
          style={[
            styles.toggleLabel,
            highlighted ? styles.toggleLabelActive : null,
          ]}
        >
          {label}
        </Text>
      </Pressable>
      <Switch
        value={checked}
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
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  headerTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
  },
  // Panel giờ cao hết màn hình (LeftSheet) thay vì tự co theo nội dung như
  // BottomSheet trước đây, nên ScrollView phải giãn hết phần còn lại
  // (flex: 1) để cuộn đúng trong chiều cao cố định của panel.
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xl },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  errorText: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: 12,
    color: COLORS.critical,
  },
  group: { borderTopWidth: 1, borderTopColor: COLORS.borderSoft },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  groupTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  // Nội dung con lùi vào và có viền trái cùng màu nhóm để phân biệt rõ với
  // GroupHeader (tiêu đề) phía trên, thay vì nằm ngang hàng khó nhận biết.
  groupBody: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    paddingLeft: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.borderSoft,
    marginLeft: SPACING.lg,
  },
  mvtHint: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.textFaint,
  },
  mvtSubGroup: { borderTopWidth: 1, borderTopColor: '#f0f3f6' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  toggleRowActive: { backgroundColor: '#eaf5fc' },
  toggleLabelWrap: { flex: 1 },
  toggleLabel: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted },
  toggleLabelActive: { color: COLORS.primaryDark, fontWeight: '600' },
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  placeholderBox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: '#9aabb8',
    backgroundColor: '#fff',
    borderRadius: RADIUS.sm / 3,
  },
  placeholderLabel: { fontSize: 12, color: '#657b8d' },
  toast: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#153b59',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  toastText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
});
