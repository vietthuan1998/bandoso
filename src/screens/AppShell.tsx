import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountScreen } from './settings/AccountScreen';
import type { AuthGateState } from '../hooks/useAuthGate';
import { DataScreen } from './feature/DataScreen';
import HueMapScreen from './map/HueMapScreen';
import { COLORS } from '../constants/theme';
import type { MapLocateRequest } from '../services/api/dataRecords';
import { useHueMap } from '../hooks/useHueMap';
import { StatisticsScreen } from './statistics/StatisticsScreen';
import { BottomTabBar } from '../components/common/BottomTabBar';
import { PlaceholderScreen } from '../components/common/PlaceholderScreen';
import type { AppTabId } from '../types/navigation';

export default function AppShell({ auth }: { auth: AuthGateState }) {
  const [activeTab, setActiveTab] = useState<AppTabId>('map');
  const insets = useSafeAreaInsets();
  const map = useHueMap();

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
        {activeTab === 'profile' ? <AccountScreen auth={auth} /> : null}
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
