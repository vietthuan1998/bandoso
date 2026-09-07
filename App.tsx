/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import HueMapScreen from './src/components/HueMapScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  // Bản đồ số Huế tự quản lý safe area (Header/BottomSheet), nên chỉ cần
  // gọi hook này để đảm bảo SafeAreaProvider đã sẵn sàng trước khi render.
  useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <HueMapScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
