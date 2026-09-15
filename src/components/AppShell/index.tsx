import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DataScreen } from '../DataScreen';
import HueMapScreen from '../HueMapScreen';
import { COLORS } from '../HueMapScreen/theme';
import type { MapLocateRequest } from '../../map/dataRecords';
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

  // Yêu cầu "Định vị trên bản đồ" từ DataScreen (tab "Dữ liệu") — bật đúng
  // lớp MVT, chọn đúng đối tượng rồi bay camera tới toạ độ của nó khi mở lại
  // tab Bản đồ. HueMapScreen chỉ được render khi activeTab === 'map' nên tự
  // nó không giữ được yêu cầu này qua lần chuyển tab, phải nâng state lên
  // đây. `token` đảm bảo yêu cầu bay tới ĐÚNG bản ghi đã chọn trước đó vẫn
  // kích hoạt lại được (dependency của effect trong HueMapScreen so theo
  // object mới, không chỉ theo toạ độ — chọn lại đúng bản ghi cũ vẫn cần bay
  // lại nếu người dùng đã tự kéo bản đồ đi nơi khác).
  const [mapFocusRequest, setMapFocusRequest] = useState<
    (MapLocateRequest & { token: number }) | null
  >(null);
  const requestMapFocus = useCallback((request: MapLocateRequest) => {
    setMapFocusRequest({ ...request, token: Date.now() });
    setActiveTab('map');
  }, []);
  const clearMapFocusRequest = useCallback(() => setMapFocusRequest(null), []);

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {activeTab === 'map' ? (
          <HueMapScreen
            map={map}
            focusRequest={mapFocusRequest}
            onFocusHandled={clearMapFocusRequest}
          />
        ) : null}
        {activeTab === 'data' ? (
          <DataScreen onLocateOnMap={requestMapFocus} />
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
