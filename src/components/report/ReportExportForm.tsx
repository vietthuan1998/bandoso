import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
import { Icon, type IconName } from '../common/Icon';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import {
  fetchCatalogWards,
  type CatalogWard,
} from '../../services/api/catalogApi';
import { pad2 } from '../../services/gis/normalizeFeatureFields';
import {
  exportReport,
  REPORT_FORMATS,
  REPORT_KINDS,
  describeReportError,
  type ReportFormat,
  type ReportKind,
} from '../../services/report/reportApi';
import {
  openSavedReport,
  REPORT_FOLDER,
  ReportSaveError,
  saveReportToDevice,
  type SavedReport,
} from '../../services/report/reportFile';
import { describeApiError } from '../../services/api/apiError';
import { toggleInList } from '../../hooks/useSharedFilters';
import { useAuthProfile } from '../../hooks/useAuthProfile';
import { allWardsLabel, wardsWithinScope } from '../filter/FilterSheets';

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}
function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

type DateField = 'dateFrom' | 'dateTo';

/** Giá trị ban đầu — lấy từ bộ lọc đang xem (null = tất cả / không giới hạn). */
export type ReportExportInitial = {
  collectionKey: string | null;
  /** Mã ĐVHC; rỗng = mọi phường xã. */
  wardCodes: string[];
  dateFrom: string | null;
  dateTo: string | null;
  report?: ReportKind;
};

/**
 * Form xuất báo cáo (POST /reports/export) với đủ 6 tham số: format, report,
 * collections, wards, dateFrom, dateTo. Khởi tạo theo bộ lọc của màn Thống kê
 * ("xuất đúng những gì đang xem"), người dùng vẫn sửa được từng tham số.
 */
export function ReportExportForm({
  layers,
  initial,
  onClose,
}: {
  layers: Array<{ id: string; label: string }>;
  initial: ReportExportInitial;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const profile = useAuthProfile();
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [report, setReport] = useState<ReportKind>(initial.report ?? 'byWard');
  const [collectionKey, setCollectionKey] = useState(initial.collectionKey);
  const [wardCodes, setWardCodes] = useState<string[]>(initial.wardCodes);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);

  const [wards, setWards] = useState<CatalogWard[]>([]);
  const [openList, setOpenList] = useState<'layer' | 'ward' | null>(null);
  const [iosEditing, setIosEditing] = useState<DateField | null>(null);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{
    error: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCatalogWards().then(
      items => {
        if (!cancelled) setWards(items);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const dateValue = (field: DateField) =>
    field === 'dateFrom' ? dateFrom : dateTo;
  const setDateValue = (field: DateField, value: string | null) =>
    field === 'dateFrom' ? setDateFrom(value) : setDateTo(value);

  // Giới hạn chọn: không quá hôm nay, và dateFrom <= dateTo.
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

  const openDatePicker = (field: DateField) => {
    const current = dateValue(field);
    const value = current ? new Date(`${current}T00:00:00`) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        ...bounds(field),
        onValueChange: (_event, selected) =>
          setDateValue(field, toIsoDate(selected)),
      });
      return;
    }
    if (!current) setDateValue(field, toIsoDate(value));
    setIosEditing(editing => (editing === field ? null : field));
  };

  const submit = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const file = await exportReport({
        format,
        report,
        collections: collectionKey ? [collectionKey] : [],
        wards: wardCodes,
        dateFrom,
        dateTo,
      });
      // Bước lưu và bước mở báo lỗi riêng — lỗi ghi file không được hiện
      // thành "không có app để mở".
      let saved: SavedReport;
      try {
        saved = await saveReportToDevice(file);
      } catch (error) {
        if (__DEV__) console.warn('[report] lưu file thất bại', error);
        const reason =
          error instanceof ReportSaveError ? error.reason : 'saveFailed';
        setMessage({ error: true, text: t(`report.errors.${reason}`) });
        return;
      }
      const location = t(
        Platform.OS === 'android'
          ? 'report.locationAndroid'
          : 'report.locationIos',
        { folder: REPORT_FOLDER, name: saved.filename },
      );
      try {
        const opened = await openSavedReport(saved);
        setMessage(
          opened
            ? { error: false, text: t('report.savedTo', { location }) }
            : { error: true, text: t('report.errors.noApp', { location }) },
        );
      } catch (error) {
        if (__DEV__) console.warn('[report] mở file thất bại', error);
        setMessage({
          error: true,
          text: t('report.errors.openFailed', { location }),
        });
      }
    } catch (error) {
      // Theo error.code; thông điệp tiếng Việt của server + mã tra cứu nếu có.
      const { kind, info } = await describeReportError(error);
      setMessage({
        error: true,
        text:
          kind === 'unauthorized'
            ? t('report.errors.unauthorized')
            : describeApiError(info, t(`report.errors.${kind}`), id =>
                t('common.requestId', { id }),
              ),
      });
    } finally {
      setExporting(false);
    }
  };

  const toggleList = (list: 'layer' | 'ward') =>
    setOpenList(current => (current === list ? null : list));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('report.title')}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Icon name="close" size={18} color={COLORS.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <FieldLabel text={t('report.layer')} />
        <SelectField
          icon="database"
          label={
            layers.find(layer => layer.id === collectionKey)?.label ??
            collectionKey ??
            t('statistics.filters.allLayers')
          }
          open={openList === 'layer'}
          onToggle={() => toggleList('layer')}
          options={[
            { value: null, label: t('statistics.filters.allLayers') },
            ...layers.map(layer => ({ value: layer.id, label: layer.label })),
          ]}
          value={collectionKey}
          onChange={value => {
            setCollectionKey(value);
            setOpenList(null);
          }}
        />

        <FieldLabel text={t('report.format')} />
        <Segmented
          options={REPORT_FORMATS.map(value => ({
            value,
            label: value.toUpperCase(),
          }))}
          value={format}
          onChange={setFormat}
        />

        <FieldLabel text={t('report.kind')} />
        <Segmented
          options={REPORT_KINDS.map(value => ({
            value,
            label: t(`report.kinds.${value}`),
          }))}
          value={report}
          onChange={setReport}
        />

        <FieldLabel text={t('report.wards')} />
        <SelectField
          icon="pin"
          label={
            wardCodes.length === 0
              ? allWardsLabel(profile, t)
              : wardCodes.length === 1
              ? wards.find(ward => ward.code === wardCodes[0])?.name ??
                wardCodes[0]
              : t('filters.wardCount', { count: wardCodes.length })
          }
          open={openList === 'ward'}
          onToggle={() => toggleList('ward')}
          options={[
            { value: null, label: allWardsLabel(profile, t) },
            ...wardsWithinScope(wards, profile).map(ward => ({
              value: ward.code,
              label: ward.name,
            })),
          ]}
          isActive={value =>
            value === null ? wardCodes.length === 0 : wardCodes.includes(value)
          }
          onChange={value =>
            // Chọn nhiều: chạm để bật/tắt, "Tất cả" xoá lựa chọn.
            setWardCodes(current =>
              value === null ? [] : toggleInList(current, value),
            )
          }
        />

        <View style={styles.dateRow}>
          {(['dateFrom', 'dateTo'] as const).map(field => (
            <View key={field} style={styles.dateCol}>
              <FieldLabel text={t(`report.${field}`)} />
              <View style={styles.selectBox}>
                <Pressable
                  onPress={() => openDatePicker(field)}
                  style={styles.dateButton}
                  accessibilityRole="button"
                >
                  <Icon name="calendar" size={14} color={COLORS.textMuted} />
                  <Text style={styles.selectText} numberOfLines={1}>
                    {dateValue(field)
                      ? formatIsoDate(dateValue(field) as string)
                      : t('report.noLimit')}
                  </Text>
                </Pressable>
                {dateValue(field) ? (
                  <Pressable
                    onPress={() => {
                      setDateValue(field, null);
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
              new Date(
                `${dateValue(iosEditing) ?? toIsoDate(new Date())}T00:00:00`,
              )
            }
            mode="date"
            display="inline"
            {...bounds(iosEditing)}
            onValueChange={(_event, selected) => {
              if (selected) setDateValue(iosEditing, toIsoDate(selected));
            }}
          />
        ) : null}

        {message ? (
          <Text
            style={[styles.message, message.error ? styles.messageError : null]}
          >
            {message.text}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={exporting}
          style={[styles.submit, exporting ? styles.submitDisabled : null]}
          accessibilityRole="button"
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Icon name="share" size={14} color="#ffffff" />
          )}
          <Text style={styles.submitText}>
            {exporting ? t('report.exporting') : t('report.submit')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

/** Ô chọn xổ danh sách ngay trong form (không mở thêm Modal chồng lên sheet). */
function SelectField({
  icon,
  label,
  open,
  onToggle,
  options,
  value,
  isActive = option => option === value,
  onChange,
}: {
  icon: IconName;
  label: string;
  open: boolean;
  onToggle: () => void;
  options: Array<{ value: string | null; label: string }>;
  value?: string | null;
  /** Mặc định: đang chọn khi bằng `value`. Chọn nhiều thì truyền hàm riêng. */
  isActive?: (value: string | null) => boolean;
  onChange: (value: string | null) => void;
}) {
  return (
    <>
      <Pressable
        onPress={onToggle}
        style={styles.selectBox}
        accessibilityRole="button"
      >
        <Icon name={icon} size={14} color={COLORS.textMuted} />
        <Text style={styles.selectText} numberOfLines={1}>
          {label}
        </Text>
        <Icon
          name={open ? 'chevronUp' : 'chevronDown'}
          size={16}
          color={COLORS.textFaint}
        />
      </Pressable>
      {open ? (
        <View style={styles.optionList}>
          <ScrollView nestedScrollEnabled>
            {options.map(option => {
              const active = isActive(option.value);
              return (
                <Pressable
                  key={option.value ?? 'all'}
                  onPress={() => onChange(option.value)}
                  style={[styles.option, active ? styles.optionActive : null]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active ? styles.optionTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {active ? (
                    <Icon name="check" size={14} color={COLORS.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active ? styles.segmentActive : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.segmentText,
                active ? styles.segmentTextActive : null,
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexShrink: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xs,
  },
  segmentActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  segmentTextActive: { color: '#ffffff' },
  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectText: { flex: 1, fontSize: 13, color: COLORS.text },
  optionList: {
    maxHeight: 220,
    marginTop: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  optionActive: { backgroundColor: '#eaf5fc' },
  optionText: { fontSize: 13, color: COLORS.text },
  optionTextActive: { color: COLORS.primaryDark, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: SPACING.sm },
  dateCol: { flex: 1 },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  message: { marginTop: SPACING.md, fontSize: 12, color: COLORS.ok },
  messageError: { color: COLORS.critical },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
