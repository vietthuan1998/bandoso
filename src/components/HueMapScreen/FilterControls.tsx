import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { COLORS, RADIUS, SPACING } from './theme';

/** "Chip" bộ lọc dùng chung cho StatisticsScreen và DataScreen — mở 1 bottom
 * sheet chọn giá trị khi bấm. */
export function FilterChip({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.filterChip, disabled ? styles.filterChipDisabled : null]}
      accessibilityRole="button"
      accessibilityState={disabled ? { disabled: true } : undefined}
    >
      <Icon name={icon} size={13} color={COLORS.textMuted} />
      <Text style={styles.filterChipText} numberOfLines={1}>
        {label}
      </Text>
      {!disabled ? (
        <Icon name="chevronDown" size={11} color={COLORS.textFaint} />
      ) : null}
    </Pressable>
  );
}

/** 1 dòng lựa chọn trong bottom sheet của FilterChip — "hint" (vd. số đếm) tuỳ chọn. */
export function PickerOption({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pickerOption, active ? styles.pickerOptionActive : null]}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.pickerOptionText,
          active ? styles.pickerOptionTextActive : null,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.pickerOptionRight}>
        {hint ? <Text style={styles.pickerOptionHint}>{hint}</Text> : null}
        {active ? <Icon name="check" size={14} color={COLORS.primary} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  filterChipDisabled: { opacity: 0.5 },
  filterChipText: { flex: 1, fontSize: 11, color: COLORS.text },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  pickerOptionActive: { backgroundColor: '#eaf5fc' },
  pickerOptionText: { flex: 1, fontSize: 13, color: COLORS.text },
  pickerOptionTextActive: { color: COLORS.primaryDark, fontWeight: '700' },
  pickerOptionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerOptionHint: { fontSize: 11, color: COLORS.textFaint },
});
