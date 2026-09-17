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

export default function AppShell() {
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
