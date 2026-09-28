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
import AppShell from './src/screens/AppShell';
import { useAuthGate } from './src/hooks/useAuthGate';

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
  // Hệ thống dùng được khi chưa đăng nhập (bản đồ + dữ liệu công khai qua
  // /map/*, /catalog/* không cần token) — auth chỉ gate tab "Tài khoản",
  // không chặn cả app. Xem AppShell -> AccountScreen.
  const auth = useAuthGate();

  return (
    <View style={styles.container}>
      <AppShell auth={auth} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
