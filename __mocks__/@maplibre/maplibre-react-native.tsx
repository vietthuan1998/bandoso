/**
 * Mock thủ công cho @maplibre/maplibre-react-native trong môi trường Jest.
 *
 * Thư viện dùng TurboModule/Fabric native component thật (MLRNCameraModule,
 * MLRNMapView...) nên không thể chạy trong Jest (không có binary native).
 * Đây là smoke test render cây component (mục 24.1 "Unit"), không kiểm thử
 * hành vi bản đồ thật — hành vi bản đồ thật được kiểm chứng bằng chạy app
 * thật trên thiết bị/simulator (mục 5.2), không phải bằng Jest.
 */
import * as React from 'react';
import { View } from 'react-native';

function passthrough(displayName: string) {
  const Component = React.forwardRef<unknown, { children?: React.ReactNode }>(
    ({ children, ...rest }, ref) => (
      <View ref={ref as never} {...rest}>
        {children}
      </View>
    ),
  );
  Component.displayName = displayName;
  return Component;
}

export const Map = passthrough('Map');
export const Camera = Object.assign(passthrough('Camera'), {
  // Các phương thức gọi qua cameraRef trong code thật (vd. fitBounds trong
  // HueMapScreen/index.tsx) — mock thành no-op để test mount không throw.
});
export const GeoJSONSource = passthrough('GeoJSONSource');
export const VectorSource = passthrough('VectorSource');
export const Layer = passthrough('Layer');
// Chấm "vị trí của tôi" (MapCanvas.tsx) — không có vị trí thật trong Jest
// (LocationManager mock ở dưới không trả toạ độ nào), nên chỉ mount rỗng để
// test không throw khi showUserLocation=true.
export const UserLocation = passthrough('UserLocation');

export const TransformRequestManager = {
  addHeader: () => {},
};

// Dùng bởi LocateButton (src/components/HueMapScreen/LocateButton.tsx) — mock
// thành no-op trả về "chưa xin được quyền/vị trí" để test mount/nhấn nút
// không throw, không đụng tới API định vị thật của thiết bị.
export const LocationManager = {
  requestPermissions: async () => false,
  getCurrentPosition: async () => undefined,
};

export type CameraRef = {
  fitBounds: (...args: unknown[]) => void;
};
export type FilterSpecification = unknown;
export type PressEventWithFeatures = unknown;
