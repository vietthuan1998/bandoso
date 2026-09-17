import { StyleSheet, Text } from 'react-native';

// Ứng dụng web dùng font icon "Material Symbols". Bản mobile này chưa gắn
// thêm icon font/SVG nào để giữ danh sách phụ thuộc gọn nhẹ, nên dùng glyph
// Unicode/emoji hệ thống làm icon tạm thời — dễ thay bằng react-native-vector-icons
// hoặc react-native-svg sau này mà không đổi API của component.
const GLYPHS = {
  close: '✕',
  search: '\u{1F50D}',
  chevronDown: '▾',
  chevronRight: '›',
  chevronLeft: '‹',
  info: 'ℹ️',
  pin: '\u{1F4CD}',
  language: '\u{1F310}',
  check: '✓',

  map: '\u{1F5FA}\u{FE0F}',
  database: '\u{1F5C4}\u{FE0F}',
  statistics: '\u{1F4CA}',
  tracking: '\u{1F4E1}',
  profile: '\u{1F464}',
  construction: '\u{1F6A7}',

  checkCircle: '\u{2705}',
  landParcel: '\u{1F7EB}',
  factory: '\u{1F3ED}',
  recycle: '\u{267B}\u{FE0F}',
  cemetery: '\u{1FAA6}',
  microscope: '\u{1F52C}',
  testTube: '\u{1F9EA}',
  crane: '\u{1F3D7}\u{FE0F}',
  antenna: '\u{1F4E1}',
  satellite: '\u{1F6F0}\u{FE0F}',

  locate: '\u{2316}',
  refresh: '\u{1F504}',
  warning: '\u{26A0}\u{FE0F}',
  calendar: '\u{1F4C5}',
  share: '\u{1F4E4}',
  status: '\u{1F4CB}',
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
