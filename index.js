/**
 * @format
 */

import { AppRegistry } from 'react-native';

// Phải import trước App: preset Babel của React Native bật "inline requires",
// nên nếu chỉ import i18n từ bên trong component thì lệnh khởi tạo i18next có
// thể bị hoãn tới sau lần render đầu tiên (gây lỗi "no i18next instance").
// Import side-effect ở entry point đảm bảo i18n luôn sẵn sàng trước khi
// AppRegistry render cây component.
import './src/i18n';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
