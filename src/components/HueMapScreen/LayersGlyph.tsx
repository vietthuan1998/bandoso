import { Image } from 'react-native';

// Icon "layers" thật của Google Material Symbols (không phải tự vẽ), tải từ
// https://github.com/google/material-design-icons — cấp phép Apache-2.0.
// Ảnh gốc là hình đen trên nền trong suốt, tô màu qua style.tintColor nên
// dùng được với bất kỳ màu nào mà không cần nhiều file theo màu.
const LAYERS_ICON = require('../../assets/icons/layers.png');

export function LayersGlyph({
  size = 20,
  color = '#ffffff',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Image
      source={LAYERS_ICON}
      resizeMode="contain"
      style={{ width: size, height: size, tintColor: color }}
    />
  );
}
