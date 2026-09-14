import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HueMapScreen from '../HueMapScreen';
import { COLORS } from '../HueMapScreen/theme';
import { useHueMap } from '../../map/useHueMap';
import { StatisticsScreen } from '../StatisticsScreen';
import { BottomTabBar } from './BottomTabBar';
import { PlaceholderScreen } from './PlaceholderScreen';
import type { AppTabId } from './tabs';

/**
 * Khung điều hướng gốc của app — bottom-nav 5 tab theo đúng mockup trong
 * mota/1..5.jpg. Tab "Bản đồ" (HueMapScreen) và "Thống kê" (StatisticsScreen)
 * đã có màn hình thật; 3 tab còn lại hiện là màn chờ vì chưa có API/registry
 * thật (xem PlaceholderScreen).
 *
 * useHueMap() được gọi Ở ĐÂY (cấp cha), không gọi trong HueMapScreen — để
 * dữ liệu phường/xã, dự án tải một lần, không bị mất khi chuyển tab rồi quay
 * lại. StatisticsScreen KHÔNG dùng dữ liệu này nữa — từ khi dựng lại theo
 * mota/2.jpg, tab Thống kê tự gọi API Directus riêng (aggregate/count theo
 * collection, xem map/statisticsOverview.ts) thay vì tính lại từ
 * wards/projects đã tải cho bản đồ.
 */
export default function AppShell() {
  const [activeTab, setActiveTab] = useState<AppTabId>('map');
  const insets = useSafeAreaInsets();
  const map = useHueMap();

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {activeTab === 'map' ? <HueMapScreen map={map} /> : null}
        {activeTab === 'data' ? (
          <PlaceholderScreen icon="database" titleKey="tabs.data" />
        ) : null}
        {activeTab === 'statistics' ? <StatisticsScreen /> : null}
        {activeTab === 'tracking' ? (
          <PlaceholderScreen icon="tracking" titleKey="tabs.tracking" />
        ) : null}
        {activeTab === 'profile' ? (
          <PlaceholderScreen icon="profile" titleKey="tabs.profile" />
        ) : null}
      </View>
      <BottomTabBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },
});
