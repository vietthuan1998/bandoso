import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { COLORS } from './theme';

export function DataOverviewFab({
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
      accessibilityLabel={t('dataOverview.openButton')}
    >
      <Icon name="statistics" size={18} color="#ffffff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
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
