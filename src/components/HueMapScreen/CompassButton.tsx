import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { COLORS } from './theme';

const NEEDLE_SIZE = 9;
export function CompassButton({
  bearing,
  onPress,
  style,
}: {
  bearing: number;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel={t('map.resetBearing')}
    >
      <View
        style={[
          styles.needleWrap,
          { transform: [{ rotate: `${-bearing}deg` }] },
        ]}
      >
        <View style={styles.needleNorth} />
        <View style={styles.needleSouth} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0f2c47',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  needleWrap: { alignItems: 'center', justifyContent: 'center' },
  needleNorth: {
    width: 0,
    height: 0,
    borderLeftWidth: NEEDLE_SIZE / 2,
    borderRightWidth: NEEDLE_SIZE / 2,
    borderBottomWidth: NEEDLE_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: COLORS.critical,
  },
  needleSouth: {
    width: 0,
    height: 0,
    borderLeftWidth: NEEDLE_SIZE / 2,
    borderRightWidth: NEEDLE_SIZE / 2,
    borderTopWidth: NEEDLE_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#c7d2dc',
  },
});
