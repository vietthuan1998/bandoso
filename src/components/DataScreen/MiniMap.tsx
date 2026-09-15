import { useEffect } from 'react';
import { Camera, Map as MapLibreMap } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { STYLE_URL } from '../../map/useHueMap';
import { ensureTileAuthHeader } from '../HueMapScreen/MapCanvas';
import { RADIUS } from '../HueMapScreen/theme';

/**
 * Bản đồ thu nhỏ, KHÔNG tương tác (mọi cử chỉ đã tắt) — định vị trực quan 1
 * bản ghi trong popup "Chi tiết dữ liệu" của DataScreen, theo đúng bố cục
 * mota (ảnh xem trước bản đồ ngay trên khối thông tin). Ghim tại
 * `coordinates` — với đối tượng dạng vùng (polygon/multipolygon), nơi gọi đã
 * quy về điểm trung tâm trước khi truyền vào đây (xem
 * extractRepresentativePoint trong map/statisticsOverview.ts), component này
 * chỉ vẽ đúng 1 điểm, không tự tính centroid.
 *
 * QUAY LẠI DÙNG <Map> SỐNG (không dùng StaticMapImageManager — đã thử,
 * nhưng ảnh tĩnh không tải được trên máy thật, có thể do module native chưa
 * được build vào app hoặc hạn chế khác không kiểm chứng được từ môi trường
 * này). <Map> sống render đúng dữ liệu thật (đã xác nhận hoạt động trước đó)
 * nhưng là 1 bề mặt native riêng (SurfaceView/tương đương trên Android) —
 * KHÔNG bị cắt bởi `overflow: hidden` của View cha khi nằm trong vùng cuộn.
 * Vì vậy component này CHỈ ĐƯỢC ĐẶT NGOÀI mọi ScrollView (xem DataScreen —
 * mini-map nằm ở phần cố định phía trên popup, không cuộn cùng danh sách
 * thuộc tính) — tự nó không di chuyển thì không có gì để "tràn" ra khi vuốt.
 *
 * Dùng lại nguyên STYLE_URL/ensureTileAuthHeader của MapCanvas.tsx (bản đồ
 * chính) để cùng 1 nền bản đồ, cùng cơ chế xác thực tile — không phải style
 * riêng biệt.
 */
export function DataRecordMiniMap({
  coordinates,
  color,
  height = 150,
}: {
  coordinates: [number, number];
  color: string;
  height?: number;
}) {
  useEffect(() => {
    ensureTileAuthHeader();
  }, []);

  return (
    <View style={[styles.wrap, { height }]}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={STYLE_URL}
        logo={false}
        attribution={false}
        dragPan={false}
        touchZoom={false}
        doubleTapZoom={false}
        doubleTapHoldZoom={false}
        touchRotate={false}
        touchPitch={false}
      >
        <Camera initialViewState={{ center: coordinates, zoom: 15.5 }} />
      </MapLibreMap>
      {/* Ghim vị trí — vẽ bằng View thuần (chấm + chân nhọn), đặt cố định
          giữa khung ảnh xem trước vì camera luôn canh giữa đúng `coordinates`
          (initialViewState.center), không cần ViewAnnotation gắn toạ độ. */}
      <View pointerEvents="none" style={styles.pinWrap}>
        <View style={[styles.pinHead, { backgroundColor: color }]} />
        <View style={[styles.pinTail, { borderTopColor: color }]} />
      </View>
    </View>
  );
}

/** Khối thay thế khi bản ghi không xác định được toạ độ — vẫn giữ đúng chiều
 * cao của mini-map để bố cục popup không nhảy giật, không giả vờ có bản đồ. */
export function DataRecordMiniMapPlaceholder({
  message,
  height = 150,
}: {
  message: string;
  height?: number;
}) {
  return (
    <View style={[styles.wrap, styles.placeholder, { height }]}>
      <Text style={styles.placeholderText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#e2e9ef',
  },
  pinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHead: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinTail: {
    width: 0,
    height: 0,
    marginTop: -3,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 11, color: '#8a99a8', textAlign: 'center', paddingHorizontal: 20 },
});
