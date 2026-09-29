import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { BottomSheet } from '../common/BottomSheet';
import { Icon } from '../common/Icon';
import { PickerOption } from './FilterControls';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { shortWardName, type CatalogWard } from '../../services/api/catalogApi';
import { toggleInList } from '../../hooks/useSharedFilters';
import { pad2 } from '../../services/gis/normalizeFeatureFields';

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Nhãn ô lọc phường xã: "Tất cả", tên một phường, hoặc "N phường, xã". */
export function wardFilterLabel(
  selected: string[],
  wards: CatalogWard[],
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (selected.length === 0) return t('statistics.filters.allWards');
  if (selected.length === 1) {
    const ward = wards.find(item => item.code === selected[0]);
    return ward ? shortWardName(ward.name) : selected[0];
  }
  return t('filters.wardCount', { count: selected.length });
}

/** Nhãn ô lọc thời gian. */
export function dateRangeLabel(
  dateFrom: string | null,
  dateTo: string | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (dateFrom && dateTo) {
    return t('filters.dateRange', {
      from: formatIsoDate(dateFrom),
      to: formatIsoDate(dateTo),
    });
  }
  if (dateFrom) return t('filters.dateFrom', { date: formatIsoDate(dateFrom) });
  if (dateTo)
    return t('statistics.filters.dateTo', { date: formatIsoDate(dateTo) });
  return t('filters.anyTime');
}

/**
 * Chọn nhiều phường xã theo mã ĐVHC (danh mục /catalog/wards). Chạm một
 * dòng để bật/tắt; "Tất cả" xoá lựa chọn.
 */
export function WardFilterSheet({
  visible,
  onClose,
  wards,
  selected,
  onChange,
  hintFor,
}: {
  visible: boolean;
  onClose: () => void;
  wards: CatalogWard[];
  selected: string[];
  onChange: (next: string[]) => void;
  hintFor?: (code: string) => string | undefined;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={600}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>{t('filters.wardsTitle')}</Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={styles.doneText}>{t('filters.done')}</Text>
        </Pressable>
      </View>
      <ScrollView>
        <PickerOption
          label={t('statistics.filters.allWards')}
          active={selected.length === 0}
          onPress={() => onChange([])}
        />
        {wards.map(ward => (
          <PickerOption
            key={ward.code}
            label={ward.name}
            hint={hintFor?.(ward.code)}
            active={selected.includes(ward.code)}
            onPress={() => onChange(toggleInList(selected, ward.code))}
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

type DateField = 'dateFrom' | 'dateTo';

/** Chọn khoảng thời gian dateFrom–dateTo (yyyy-mm-dd, không quá hôm nay). */
export function DateRangeSheet({
  visible,
  onClose,
  dateFrom,
  dateTo,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  dateFrom: string | null;
  dateTo: string | null;
  onChange: (range: { dateFrom: string | null; dateTo: string | null }) => void;
}) {
  const { t } = useTranslation();
  const [iosEditing, setIosEditing] = useState<DateField | null>(null);

  const valueOf = (field: DateField) =>
    field === 'dateFrom' ? dateFrom : dateTo;
  const setValue = (field: DateField, value: string | null) =>
    onChange({
      dateFrom: field === 'dateFrom' ? value : dateFrom,
      dateTo: field === 'dateTo' ? value : dateTo,
    });
  const bounds = (field: DateField) => ({
    minimumDate:
      field === 'dateTo' && dateFrom
        ? new Date(`${dateFrom}T00:00:00`)
        : undefined,
    maximumDate:
      field === 'dateFrom' && dateTo
        ? new Date(`${dateTo}T00:00:00`)
        : new Date(),
  });

  const open = (field: DateField) => {
    const current = valueOf(field);
    const value = current ? new Date(`${current}T00:00:00`) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        ...bounds(field),
        onValueChange: (_event, selected) =>
          setValue(field, toIsoDate(selected)),
      });
      return;
    }
    if (!current) setValue(field, toIsoDate(value));
    setIosEditing(editing => (editing === field ? null : field));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeight={640}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>{t('filters.dateTitle')}</Text>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
          <Text style={styles.doneText}>{t('filters.done')}</Text>
        </Pressable>
      </View>
      <View style={styles.dateRow}>
        {(['dateFrom', 'dateTo'] as const).map(field => (
          <View key={field} style={styles.dateCol}>
            <Text style={styles.fieldLabel}>{t(`report.${field}`)}</Text>
            <View style={styles.dateBox}>
              <Pressable
                onPress={() => open(field)}
                style={styles.dateButton}
                accessibilityRole="button"
              >
                <Icon name="calendar" size={14} color={COLORS.textMuted} />
                <Text style={styles.dateText} numberOfLines={1}>
                  {valueOf(field)
                    ? formatIsoDate(valueOf(field) as string)
                    : t('report.noLimit')}
                </Text>
              </Pressable>
              {valueOf(field) ? (
                <Pressable
                  onPress={() => {
                    setValue(field, null);
                    if (iosEditing === field) setIosEditing(null);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('report.clearDate')}
                >
                  <Icon name="close" size={14} color={COLORS.textFaint} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      {Platform.OS === 'ios' && iosEditing ? (
        <DateTimePicker
          value={
            new Date(`${valueOf(iosEditing) ?? toIsoDate(new Date())}T00:00:00`)
          }
          mode="date"
          display="inline"
          {...bounds(iosEditing)}
          onValueChange={(_event, selected) => {
            if (selected) setValue(iosEditing, toIsoDate(selected));
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  sheetTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  doneText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  dateRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  dateCol: { flex: 1 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dateText: { flex: 1, fontSize: 13, color: COLORS.text },
});
