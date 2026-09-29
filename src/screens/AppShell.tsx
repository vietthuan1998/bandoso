import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountScreen } from './settings/AccountScreen';
import type { AuthGateState } from '../hooks/useAuthGate';
import { DataScreen } from './feature/DataScreen';
import HueMapScreen from './map/HueMapScreen';
import { COLORS } from '../constants/theme';
import type { MapLocateRequest } from '../services/api/dataRecords';
import { hasPermission } from '../services/auth/authClient';
import { useHueMap } from '../hooks/useHueMap';
import { SharedFiltersProvider } from '../hooks/useSharedFilters';
import { StatisticsScreen } from './statistics/StatisticsScreen';
import { BottomTabBar } from '../components/common/BottomTabBar';
import { PlaceholderScreen } from '../components/common/PlaceholderScreen';
import type { AppTabId } from '../types/navigation';

export default function AppShell({ auth }: { auth: AuthGateState }) {
  const [activeTab, setActiveTab] = useState<AppTabId>('map');
  const insets = useSafeAreaInsets();
  const map = useHueMap();
  // Trạng thái bật/tắt lớp MVT sống ở đây để không mất khi chuyển tab.
  const [mvtLayersVisible, setMvtLayersVisible] = useState<
    Record<string, boolean>
  >({});

  // Ẩn menu theo permissions chỉ là trải nghiệm người dùng — server vẫn kiểm
  // tra quyền (tài liệu mục 10). Khách vẫn thấy tab để được nhắc đăng nhập.
  const hiddenTabs: AppTabId[] =
    auth.status === 'authenticated' &&
    auth.profile &&
    !hasPermission(auth.profile, 'statistics.read')
      ? ['statistics']
      : [];
  const statisticsHidden = hiddenTabs.includes('statistics');
  useEffect(() => {
    if (statisticsHidden && activeTab === 'statistics') setActiveTab('map');
  }, [statisticsHidden, activeTab]);

  const [mapFocusRequest, setMapFocusRequest] = useState<
    (MapLocateRequest & { token: number }) | null
  >(null);
  const requestMapFocus = useCallback((request: MapLocateRequest) => {
    setMapFocusRequest({ ...request, token: Date.now() });
    setActiveTab('map');
  }, []);
  const clearMapFocusRequest = useCallback(() => setMapFocusRequest(null), []);

  return (
    <SharedFiltersProvider>
      <View style={styles.root}>
        <View style={styles.content}>
          {activeTab === 'map' ? (
            <HueMapScreen
              map={map}
              mvtLayersVisible={mvtLayersVisible}
              onMvtLayersVisibleChange={setMvtLayersVisible}
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
          {activeTab === 'profile' ? <AccountScreen auth={auth} /> : null}
        </View>
        <BottomTabBar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          bottomInset={insets.bottom}
          hiddenTabs={hiddenTabs}
        />
      </View>
    </SharedFiltersProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1 },
});
