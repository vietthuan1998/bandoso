import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { LayersGlyph } from './LayersGlyph';
import { COLORS } from './theme';

/**
 * Nút tròn nổi mở menu lớp bản đồ, kiểu Google Maps — đúng theo mota/1.jpg:
 * góc trên-trái khung bản đồ (ngay dưới thanh header/tìm kiếm), hình tròn
 * nền xanh, icon 3 lớp xếp chồng.
 */
export function LayersFab({
  onPress,
  top,
}: {
  onPress: () => void;
  top: number;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, { top }]}
      accessibilityRole="button"
      accessibilityLabel={t('header.toggleMenu')}
    >
      <LayersGlyph size={22} color="#ffffff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    shadowColor: '#0f2c47',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
