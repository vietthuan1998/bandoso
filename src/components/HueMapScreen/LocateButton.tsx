import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LocationManager } from '@maplibre/maplibre-react-native';
import { Icon } from './Icon';
import { COLORS, RADIUS, SPACING } from './theme';

export function LocateButton({
  onLocate,
  style,
}: {
  onLocate: (coords: [number, number]) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const flashUnavailable = () => {
    setUnavailable(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setUnavailable(false), 2500);
  };

  const handlePress = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const granted = await LocationManager.requestPermissions();
      if (!granted) {
        // Người dùng từ chối quyền — dừng lại, không phải lỗi.
        flashUnavailable();
        return;
      }
      const position = await LocationManager.getCurrentPosition();
      if (!position) {
        flashUnavailable();
        return;
      }
      onLocate([position.coords.longitude, position.coords.latitude]);
    } catch {
      flashUnavailable();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={loading}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel={t('map.locateMe')}
    >
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.primary} />
      ) : (
        <Icon
          name="locate"
          size={22}
          color={unavailable ? COLORS.textFaint : COLORS.primary}
        />
      )}
      {unavailable ? (
        <Text style={styles.hint} numberOfLines={2}>
          {t('map.locationUnavailable')}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#0f2c47',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  hint: {
    position: 'absolute',
    right: 52,
    width: 150,
    fontSize: 10,
    lineHeight: 13,
    color: COLORS.textMuted,
    textAlign: 'right',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
});
