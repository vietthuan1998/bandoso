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
import AppShell from './src/components/AppShell';

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
  // AppShell (bottom-nav 5 tab + các màn hình con) tự quản lý safe area, nên
  // chỉ cần gọi hook này để đảm bảo SafeAreaProvider đã sẵn sàng trước khi
  // render.
  useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <AppShell />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
