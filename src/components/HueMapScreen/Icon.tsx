import { StyleSheet, Text } from 'react-native';

// Ứng dụng web dùng font icon "Material Symbols". Bản mobile này chưa gắn
// thêm icon font/SVG nào để giữ danh sách phụ thuộc gọn nhẹ, nên dùng glyph
// Unicode/emoji hệ thống làm icon tạm thời — dễ thay bằng react-native-vector-icons
// hoặc react-native-svg sau này mà không đổi API của component.
const GLYPHS = {
  menu: '☰',
  close: '✕',
  search: '\u{1F50D}',
  chevronDown: '▾',
  chevronRight: '›',
  layers: '\u{1F5FA}️',
  info: 'ℹ️',
  pin: '\u{1F4CD}',
  language: '\u{1F310}',
  check: '✓',
} as const;

export type IconName = keyof typeof GLYPHS;

export function Icon({
  name,
  size = 18,
  color = '#17263c',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      allowFontScaling={false}
      style={[styles.glyph, { fontSize: size, color, lineHeight: size * 1.15 }]}
    >
      {GLYPHS[name]}
    </Text>
  );
}

const styles = StyleSheet.create({
  glyph: { textAlign: 'center' },
});
