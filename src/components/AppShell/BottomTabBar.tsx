import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from '../HueMapScreen/Icon';
import { COLORS } from '../HueMapScreen/theme';
import type { AppTabId } from './tabs';

const TABS: Array<{ id: AppTabId; icon: IconName; labelKey: string }> = [
  { id: 'map', icon: 'map', labelKey: 'tabs.map' },
  { id: 'data', icon: 'database', labelKey: 'tabs.data' },
  { id: 'statistics', icon: 'statistics', labelKey: 'tabs.statistics' },
  { id: 'tracking', icon: 'tracking', labelKey: 'tabs.tracking' },
  { id: 'profile', icon: 'profile', labelKey: 'tabs.profile' },
];

export function BottomTabBar({
  activeTab,
  onChangeTab,
  bottomInset,
}: {
  activeTab: AppTabId;
  onChangeTab: (tab: AppTabId) => void;
  bottomInset: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {TABS.map(tab => {
        const active = tab.id === activeTab;
        const color = active ? COLORS.primary : COLORS.textFaint;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChangeTab(tab.id)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(tab.labelKey)}
          >
            <Icon name={tab.icon} size={20} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    paddingTop: 8,
    shadowColor: '#0f2c47',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  label: { fontSize: 10, fontWeight: '700' },
});
