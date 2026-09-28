import { useEffect, useMemo, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { BottomSheet } from '../../components/common/BottomSheet';
import {
  FilterChip,
  PickerOption,
} from '../../components/filter/FilterControls';
import { Icon, type IconName } from '../../components/common/Icon';
import { CHART_WIDTH, COLORS, RADIUS, SPACING } from '../../constants/theme';
import { MEASURE_UNITS } from '../../constants/measureUnits';
import { useMapRegistry } from '../../services/map/mapRegistry';
import {
  fetchCatalogWards,
  type CatalogWard,
} from '../../services/api/catalogApi';
import { pad2 } from '../../services/gis/normalizeFeatureFields';
import {
  fetchStatisticsGroups,
  fetchStatisticsMeasures,
  fetchStatisticsSummary,
  fetchStatisticsTrend,
  statisticsErrorKind,
  toTrendPoints,
  type StatisticsBucket,
  type StatisticsDimension,
  type StatisticsErrorKind,
  type StatisticsGroupResult,
  type StatisticsFilters,
  type StatisticsMeasure,
  type StatisticsSummaryResult,
  type StatisticsTotals,
} from '../../services/statistics/statisticsApi';
import type { TrendPoint } from '../../services/statistics/statisticsOverview';
import { DonutChart } from '../../components/statistics/DonutChart';
import { TrendChart } from '../../components/statistics/TrendChart';
import { ReportExportForm } from '../../components/report/ReportExportForm';

/**
 * Màn Thống kê: toàn bộ số liệu lấy từ API /statistics/* của BFF (tài liệu
 * mục 7). Bốn quy tắc hiển thị bắt buộc: null ≠ 0 (không vẽ thành 0), không
 * hiển thị phần trăm hoàn thành khi completionRatio null, giữ đủ byWard kể cả
 * 0, luôn hiển thị unknownWard + meta.notes và không tự cộng bù.
 */

const WARD_PREVIEW_COUNT = 5;
const BUCKETS: StatisticsBucket[] = ['day', 'month', 'quarter'];
const DIMENSIONS: StatisticsDimension[] = [
  'ward',
  'status',
  'unit',
  'updatedAt',
];
const PROCESSING_KEYS = [
  'completed',
  'inProgress',
  'error',
  'overdue',
] as const;
const PROCESSING_COLOR: Record<(typeof PROCESSING_KEYS)[number], string> = {
  completed: COLORS.ok,
  inProgress: COLORS.primary,
  error: COLORS.critical,
  overdue: COLORS.warn,
};
const STATUS_PALETTE = [
  '#0878bd',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#8b5cf6',
  '#0d9488',
  '#f97316',
  '#c026d3',
  '#64748b',
];

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}
function formatPercent(value: number, fractionDigits = 1): string {
  return `${value.toLocaleString('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}
function formatDateIso(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type SummaryState =
  | { status: 'loading'; result: StatisticsSummaryResult | null }
  | { status: 'ready'; result: StatisticsSummaryResult }
  | { status: 'error'; kind: StatisticsErrorKind };

export function StatisticsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const registry = useMapRegistry();

  // Bộ lọc: collectionKey, mã ĐVHC, ngày kết thúc (dateTo).
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const [layerSheetOpen, setLayerSheetOpen] = useState(false);
  const [wardSheetOpen, setWardSheetOpen] = useState(false);
  const [bucketSheetOpen, setBucketSheetOpen] = useState(false);
  const [iosDatePickerOpen, setIosDatePickerOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState(() => new Date());
  const [wardsExpanded, setWardsExpanded] = useState(false);
  // Mỗi lần mở tăng key để form khởi tạo lại theo bộ lọc hiện tại.
  const [exportKey, setExportKey] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);

  const [wardCatalog, setWardCatalog] = useState<CatalogWard[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchCatalogWards().then(
      wards => {
        if (!cancelled) setWardCatalog(wards);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const statisticsLayers = useMemo(
    () => registry.layers.filter(layer => layer.capabilities.statistics),
    [registry.layers],
  );
  const selectedLayer = useMemo(
    () => statisticsLayers.find(layer => layer.id === selectedLayerId) ?? null,
    [statisticsLayers, selectedLayerId],
  );

  const filters = useMemo<StatisticsFilters>(
    () => ({
      collections: selectedLayerId ? [selectedLayerId] : undefined,
      wards: selectedWardId ? [selectedWardId] : undefined,
      dateTo,
    }),
    [selectedLayerId, selectedWardId, dateTo],
  );

  // ===== Tổng hợp (/statistics/summary) =====
  const [summaryState, setSummaryState] = useState<SummaryState>({
    status: 'loading',
    result: null,
  });
  const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setSummaryState(current => ({
      status: 'loading',
      result: current.status === 'error' ? null : current.result,
    }));
    fetchStatisticsSummary(filters).then(
      result => {
        if (!cancelled) setSummaryState({ status: 'ready', result });
      },
      error => {
        if (!cancelled) {
          setSummaryState({
            status: 'error',
            kind: statisticsErrorKind(error),
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [filters, reloadToken]);

  const result = summaryState.status === 'error' ? null : summaryState.result;
  const summary = result?.summary ?? null;

  // ===== Xu hướng (/statistics/{key}/trend) — chỉ khi đã chọn lớp =====
  const [bucket, setBucket] = useState<StatisticsBucket>('month');
  const [layerTrend, setLayerTrend] = useState<{
    loading: boolean;
    points: TrendPoint[];
    failed: boolean;
  }>({ loading: false, points: [], failed: false });
  useEffect(() => {
    if (!selectedLayerId) {
      setLayerTrend({ loading: false, points: [], failed: false });
      return;
    }
    let cancelled = false;
    setLayerTrend(current => ({ ...current, loading: true, failed: false }));
    fetchStatisticsTrend(selectedLayerId, bucket, filters).then(
      points => {
        if (!cancelled) {
          setLayerTrend({
            loading: false,
            points: toTrendPoints(points, bucket),
            failed: false,
          });
        }
      },
      () => {
        if (!cancelled)
          setLayerTrend({ loading: false, points: [], failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedLayerId, bucket, filters]);

  // Tất cả lớp: dùng trend có sẵn trong summary (có thể rỗng).
  const summaryTrend = useMemo(
    () => toTrendPoints(summary?.trend ?? [], 'day'),
    [summary],
  );

  // ===== Nhóm theo chiều (/statistics/{key}/groups) — chỉ khi đã chọn lớp =====
  const [dimension, setDimension] = useState<StatisticsDimension>('ward');
  const [groups, setGroups] = useState<{
    loading: boolean;
    result: StatisticsGroupResult | null;
    failed: boolean;
  }>({ loading: false, result: null, failed: false });
  useEffect(() => {
    if (!selectedLayerId) {
      setGroups({ loading: false, result: null, failed: false });
      return;
    }
    let cancelled = false;
    setGroups(current => ({ ...current, loading: true, failed: false }));
    fetchStatisticsGroups(selectedLayerId, dimension, filters).then(
      groupResult => {
        if (!cancelled) {
          setGroups({ loading: false, result: groupResult, failed: false });
        }
      },
      () => {
        if (!cancelled)
          setGroups({ loading: false, result: null, failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedLayerId, dimension, filters]);

  // ===== Đo lường (/statistics/{key}/measures) — chỉ trường trong measureFields =====
  const [measures, setMeasures] = useState<{
    loading: boolean;
    items: StatisticsMeasure[];
    failed: boolean;
  }>({ loading: false, items: [], failed: false });
  useEffect(() => {
    const fields = selectedLayer?.measureFields ?? [];
    if (!selectedLayer || fields.length === 0) {
      setMeasures({ loading: false, items: [], failed: false });
      return;
    }
    let cancelled = false;
    setMeasures(current => ({ ...current, loading: true, failed: false }));
    fetchStatisticsMeasures(selectedLayer.id, fields, filters).then(
      items => {
        if (!cancelled) setMeasures({ loading: false, items, failed: false });
      },
      () => {
        if (!cancelled)
          setMeasures({ loading: false, items: [], failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedLayer, filters]);

  // ===== Dữ liệu hiển thị =====
  const wardName = (wardId: string) =>
    wardCatalog.find(ward => ward.code === wardId)?.name ??
    summary?.byWard.find(ward => ward.wardId === wardId)?.wardName ??
    wardId;

  // Giữ nguyên mọi phường xã kể cả 0 — chỉ sắp xếp, không lọc bỏ.
  const sortedWards = useMemo(
    () => [...(summary?.byWard ?? [])].sort((a, b) => b.total - a.total),
    [summary],
  );
  const visibleWards = selectedWardId
    ? sortedWards.filter(ward => ward.wardId === selectedWardId)
    : wardsExpanded
    ? sortedWards
    : sortedWards.slice(0, WARD_PREVIEW_COUNT);
  const wardMax = sortedWards[0]?.total ?? 0;

  const sortedLayers = useMemo(
    () => [...(summary?.byLayer ?? [])].sort((a, b) => b.count - a.count),
    [summary],
  );
  const layerIcon = (collection: string): IconName =>
    registry.layers.find(
      layer => layer.id === collection || layer.collection === collection,
    )?.icon ?? 'layers';

  const scopeLabel = [
    selectedLayer?.label,
    selectedWardId ? wardName(selectedWardId) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function openDatePicker() {
    const currentValue = dateTo ? new Date(`${dateTo}T00:00:00`) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentValue,
        mode: 'date',
        maximumDate: new Date(),
        onValueChange: (_event, selectedDate) => {
          const iso = toIsoDate(selectedDate);
          setDateTo(iso === toIsoDate(new Date()) ? null : iso);
        },
      });
      return;
    }
    setPendingDate(currentValue);
    setIosDatePickerOpen(true);
  }

  const trendPoints = selectedLayerId ? layerTrend.points : summaryTrend;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('statistics.title')}</Text>
        <View style={styles.headerActions}>
          {summaryState.status === 'loading' && summary ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : null}
          <Pressable
            onPress={() => {
              setExportKey(key => key + 1);
              setExportOpen(true);
            }}
            style={styles.exportButton}
            accessibilityRole="button"
          >
            <Icon name="share" size={13} color={COLORS.primary} />
            <Text style={styles.exportButtonText}>{t('report.title')}</Text>
          </Pressable>
        </View>
      </View>

      {summaryState.status === 'error' ? (
        <StatisticsError
          kind={summaryState.kind}
          onRetry={() => setReloadToken(token => token + 1)}
        />
      ) : !summary ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('statistics.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}
        >
          <View style={styles.filterRow}>
            <FilterChip
              icon="database"
              label={selectedLayer?.label ?? t('statistics.filters.allLayers')}
              onPress={() => setLayerSheetOpen(true)}
            />
            <FilterChip
              icon="pin"
              label={
                selectedWardId
                  ? wardName(selectedWardId)
                  : t('statistics.filters.allWards')
              }
              onPress={() => setWardSheetOpen(true)}
            />
            <FilterChip
              icon="calendar"
              label={
                dateTo
                  ? t('statistics.filters.dateTo', {
                      date: formatDateIso(dateTo),
                    })
                  : t('statistics.filters.today')
              }
              onPress={openDatePicker}
            />
          </View>

          <View style={styles.totalCard}>
            <View style={styles.totalIconWrap}>
              <Icon
                name={selectedLayer?.icon ?? 'database'}
                size={22}
                color="#ffffff"
              />
            </View>
            <View style={styles.totalTextCol}>
              <Text style={styles.totalLabel} numberOfLines={1}>
                {scopeLabel || t('statistics.totalCard')}
              </Text>
              <Text style={styles.totalValue}>
                {formatNumber(summary.totals.total)}
              </Text>
              <Text style={styles.totalSubLabel}>
                {t('statistics.unknownWard')}:{' '}
                {formatNumber(summary.totals.unknownWard)}
              </Text>
            </View>
          </View>

          {result && result.notes.length > 0 ? (
            <View style={styles.notesBox}>
              <View style={styles.notesHeader}>
                <Icon name="info" size={14} color={COLORS.warningText} />
                <Text style={styles.notesTitle}>
                  {t('statistics.notesTitle')}
                </Text>
              </View>
              {result.notes.map(note => (
                <Text key={note} style={styles.notesText}>
                  • {note}
                </Text>
              ))}
            </View>
          ) : null}

          <ProcessingSection totals={summary.totals} />

          {summary.byStatus.length > 0 ? (
            <Section title={t('statistics.status.sectionTitle')}>
              <StatusBreakdown items={summary.byStatus} />
            </Section>
          ) : null}

          {selectedLayerId ? (
            <Section
              title={t('statistics.groups.sectionTitle')}
              hint={
                dimension === 'ward' && !selectedWardId
                  ? t('statistics.ward.hint')
                  : undefined
              }
            >
              <View style={styles.dimensionRow}>
                {DIMENSIONS.map(option => (
                  <Pressable
                    key={option}
                    onPress={() => setDimension(option)}
                    style={[
                      styles.dimensionChip,
                      dimension === option ? styles.dimensionChipActive : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: dimension === option }}
                  >
                    <Text
                      style={[
                        styles.dimensionChipText,
                        dimension === option
                          ? styles.dimensionChipTextActive
                          : null,
                      ]}
                    >
                      {t(`statistics.groups.${option}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <GroupsBody
                state={groups}
                // Drill-down theo tài liệu: key của nhóm phường xã -> ?wards=.
                onDrillDown={
                  dimension === 'ward' && !selectedWardId
                    ? key => setSelectedWardId(key)
                    : undefined
                }
              />
            </Section>
          ) : (
            <Section
              title={t('statistics.ward.sectionTitle')}
              hint={selectedWardId ? undefined : t('statistics.ward.hint')}
              action={
                selectedWardId
                  ? {
                      label: t('statistics.ward.clearFilter'),
                      onPress: () => setSelectedWardId(null),
                    }
                  : sortedWards.length > WARD_PREVIEW_COUNT
                  ? {
                      label: wardsExpanded
                        ? t('statistics.ward.collapse')
                        : t('statistics.ward.viewAll', {
                            count: sortedWards.length,
                          }),
                      onPress: () => setWardsExpanded(value => !value),
                    }
                  : undefined
              }
            >
              {visibleWards.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t('statistics.ward.empty')}
                </Text>
              ) : (
                visibleWards.map(ward => (
                  <WardBarRow
                    key={ward.wardId}
                    label={ward.wardName || wardName(ward.wardId)}
                    count={ward.total}
                    maxCount={wardMax}
                    onPress={
                      selectedWardId
                        ? undefined
                        : () => setSelectedWardId(ward.wardId)
                    }
                  />
                ))
              )}
              <View style={styles.unknownWardRow}>
                <Text style={styles.unknownWardLabel}>
                  {t('statistics.unknownWard')}
                </Text>
                <Text style={styles.unknownWardValue}>
                  {formatNumber(summary.totals.unknownWard)}
                </Text>
              </View>
            </Section>
          )}

          {!selectedLayerId && sortedLayers.length > 0 ? (
            <Section
              title={t('statistics.layers.sectionTitle')}
              hint={t('statistics.layers.hint')}
            >
              {sortedLayers.map((layer, index) => (
                <LayerRow
                  key={layer.collection}
                  rank={index + 1}
                  icon={layerIcon(layer.collection)}
                  label={layer.label}
                  count={layer.count}
                  total={summary.totals.total}
                  onPress={() => setSelectedLayerId(layer.collection)}
                />
              ))}
            </Section>
          ) : null}

          <Section
            title={t('statistics.trend.sectionTitle')}
            action={
              selectedLayerId
                ? {
                    label: t(`statistics.trend.${bucket}`),
                    onPress: () => setBucketSheetOpen(true),
                    icon: 'chevronDown',
                  }
                : undefined
            }
          >
            {selectedLayerId && layerTrend.loading ? (
              <View style={styles.trendLoading}>
                <ActivityIndicator color={COLORS.primary} size="small" />
              </View>
            ) : selectedLayerId && layerTrend.failed ? (
              <Text style={styles.emptyText}>{t('statistics.error')}</Text>
            ) : trendPoints.length > 0 ? (
              <TrendChart points={trendPoints} width={CHART_WIDTH} />
            ) : (
              <Text style={styles.emptyText}>
                {selectedLayerId
                  ? t('statistics.trend.empty')
                  : t('statistics.trend.selectLayer')}
              </Text>
            )}
          </Section>

          {selectedLayer && selectedLayer.measureFields.length > 0 ? (
            <Section title={t('statistics.measures.sectionTitle')}>
              {measures.loading ? (
                <View style={styles.trendLoading}>
                  <ActivityIndicator color={COLORS.primary} size="small" />
                </View>
              ) : measures.failed ? (
                <Text style={styles.emptyText}>
                  {t('statistics.measures.error')}
                </Text>
              ) : (
                measures.items.map(measure => (
                  <MeasureRow key={measure.field} measure={measure} />
                ))
              )}
            </Section>
          ) : null}
        </ScrollView>
      )}

      {/* Xuất báo cáo: phạm vi khởi tạo = bộ lọc đang xem trên màn này. */}
      <BottomSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        maxHeight={680}
      >
        <ReportExportForm
          key={exportKey}
          layers={statisticsLayers.map(layer => ({
            id: layer.id,
            label: layer.label,
          }))}
          initial={{
            collectionKey: selectedLayerId,
            wardCode: selectedWardId,
            dateFrom: null,
            dateTo,
          }}
          onClose={() => setExportOpen(false)}
        />
      </BottomSheet>

      <BottomSheet
        visible={layerSheetOpen}
        onClose={() => setLayerSheetOpen(false)}
        maxHeight={600}
      >
        <ScrollView>
          <PickerOption
            label={t('statistics.filters.allLayers')}
            active={selectedLayerId === null}
            onPress={() => {
              setSelectedLayerId(null);
              setLayerSheetOpen(false);
            }}
          />
          {statisticsLayers.map(layer => (
            <PickerOption
              key={layer.id}
              label={layer.label}
              active={selectedLayerId === layer.id}
              onPress={() => {
                setSelectedLayerId(layer.id);
                setLayerSheetOpen(false);
              }}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={wardSheetOpen}
        onClose={() => setWardSheetOpen(false)}
        maxHeight={560}
      >
        <ScrollView>
          <PickerOption
            label={t('statistics.filters.allWards')}
            active={selectedWardId === null}
            onPress={() => {
              setSelectedWardId(null);
              setWardSheetOpen(false);
            }}
          />
          {wardCatalog.map(ward => {
            const total = summary?.byWard.find(
              item => item.wardId === ward.code,
            )?.total;
            return (
              <PickerOption
                key={ward.code}
                label={ward.name}
                hint={total === undefined ? undefined : formatNumber(total)}
                active={selectedWardId === ward.code}
                onPress={() => {
                  setSelectedWardId(ward.code);
                  setWardSheetOpen(false);
                }}
              />
            );
          })}
        </ScrollView>
      </BottomSheet>

      <BottomSheet
        visible={bucketSheetOpen}
        onClose={() => setBucketSheetOpen(false)}
        maxHeight={280}
      >
        {BUCKETS.map(option => (
          <PickerOption
            key={option}
            label={t(`statistics.trend.${option}`)}
            active={bucket === option}
            onPress={() => {
              setBucket(option);
              setBucketSheetOpen(false);
            }}
          />
        ))}
      </BottomSheet>

      {Platform.OS === 'ios' ? (
        <BottomSheet
          visible={iosDatePickerOpen}
          onClose={() => setIosDatePickerOpen(false)}
          maxHeight={440}
        >
          <DateTimePicker
            value={pendingDate}
            mode="date"
            display="inline"
            maximumDate={new Date()}
            onValueChange={(_event, selectedDate) => {
              if (selectedDate) setPendingDate(selectedDate);
            }}
          />
          <View style={styles.datePickerActions}>
            <Pressable
              onPress={() => {
                setDateTo(null);
                setIosDatePickerOpen(false);
              }}
              style={styles.datePickerActionSecondary}
              accessibilityRole="button"
            >
              <Text style={styles.datePickerActionSecondaryText}>
                {t('statistics.filters.today')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const iso = toIsoDate(pendingDate);
                setDateTo(iso === toIsoDate(new Date()) ? null : iso);
                setIosDatePickerOpen(false);
              }}
              style={styles.datePickerActionPrimary}
              accessibilityRole="button"
            >
              <Text style={styles.datePickerActionPrimaryText}>
                {t('common.confirm')}
              </Text>
            </Pressable>
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

function StatisticsError({
  kind,
  onRetry,
}: {
  kind: StatisticsErrorKind;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const message =
    kind === 'unauthorized'
      ? t('statistics.needLogin')
      : kind === 'forbidden'
      ? t('statistics.forbidden')
      : t('statistics.error');
  return (
    <View style={styles.centerFill}>
      <Icon
        name={kind === 'unauthorized' ? 'profile' : 'warning'}
        size={24}
        color={kind === 'error' ? COLORS.critical : COLORS.textMuted}
      />
      <Text style={styles.errorText}>{message}</Text>
      <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
        <Text style={styles.retryText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

/**
 * completed/inProgress/error/overdue: null = chưa đo được — không vẽ ô 0,
 * không phần trăm. Tất cả null (hiện trạng toàn hệ thống) -> một dòng giải thích.
 */
function ProcessingSection({ totals }: { totals: StatisticsTotals }) {
  const { t } = useTranslation();
  const measured = PROCESSING_KEYS.filter(key => totals[key] !== null);
  return (
    <Section title={t('statistics.processing.sectionTitle')}>
      {measured.length === 0 ? (
        <Text style={styles.mutedText}>
          {t('statistics.processing.notMeasured')}
        </Text>
      ) : (
        <View style={styles.tileRow}>
          {measured.map(key => (
            <View key={key} style={styles.statusTile}>
              <View
                style={[
                  styles.statusTileDot,
                  { backgroundColor: PROCESSING_COLOR[key] },
                ]}
              />
              <Text style={styles.statusTileLabel} numberOfLines={2}>
                {t(`statistics.processing.${key}`)}
              </Text>
              <Text style={styles.statusTileValue}>
                {formatNumber(totals[key])}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Section>
  );
}

function StatusBreakdown({
  items,
}: {
  items: Array<{ status: string; label: string; count: number }>;
}) {
  const { t } = useTranslation();
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <View style={styles.statusBody}>
      <DonutChart
        segments={items.map((item, index) => ({
          color: STATUS_PALETTE[index % STATUS_PALETTE.length],
          value: item.count,
        }))}
      />
      <View style={styles.legendCol}>
        {items.map((item, index) => (
          <View key={item.status} style={styles.legendRow}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor:
                    STATUS_PALETTE[index % STATUS_PALETTE.length],
                },
              ]}
            />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.legendValue}>
              {formatNumber(item.count)}
              {total > 0
                ? ` (${formatPercent((item.count / total) * 100)})`
                : ''}
            </Text>
          </View>
        ))}
        <View style={styles.legendTotalRow}>
          <Text style={styles.legendTotalLabel}>
            {t('statistics.status.total')}
          </Text>
          <Text style={styles.legendTotalValue}>{formatNumber(total)}</Text>
        </View>
      </View>
    </View>
  );
}

function GroupsBody({
  state,
  onDrillDown,
}: {
  state: {
    loading: boolean;
    result: StatisticsGroupResult | null;
    failed: boolean;
  };
  onDrillDown?: (key: string) => void;
}) {
  const { t } = useTranslation();
  if (state.loading) {
    return (
      <View style={styles.trendLoading}>
        <ActivityIndicator color={COLORS.primary} size="small" />
      </View>
    );
  }
  if (state.failed || !state.result) {
    return <Text style={styles.emptyText}>{t('statistics.groups.error')}</Text>;
  }
  const { items, unknownCount, field } = state.result;
  const max = items.reduce((best, item) => Math.max(best, item.count), 0);
  return (
    <>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>{t('statistics.groups.empty')}</Text>
      ) : (
        items.map(item => (
          <WardBarRow
            key={item.key}
            label={item.label}
            count={item.count}
            maxCount={max}
            share={item.ratio}
            onPress={onDrillDown ? () => onDrillDown(item.key) : undefined}
          />
        ))
      )}
      <View style={styles.unknownWardRow}>
        <Text style={styles.unknownWardLabel}>
          {t('statistics.groups.unknown')}
        </Text>
        <Text style={styles.unknownWardValue}>
          {formatNumber(unknownCount)}
        </Text>
      </View>
      {field ? (
        <Text style={styles.fieldHint}>
          {t('statistics.groups.field', { field })}
        </Text>
      ) : null}
    </>
  );
}

function MeasureRow({ measure }: { measure: StatisticsMeasure }) {
  const { t } = useTranslation();
  const unit = MEASURE_UNITS[measure.field];
  const withUnit = (value: number | null) =>
    value === null || !unit
      ? formatNumber(value)
      : `${formatNumber(value)} ${unit}`;
  return (
    <View style={styles.measureBlock}>
      <Text style={styles.measureTitle}>
        {measure.label}
        {unit ? ` (${unit})` : ''}
      </Text>
      <View style={styles.measureGrid}>
        {(['sum', 'avg', 'min', 'max'] as const).map(key => (
          <View key={key} style={styles.measureCell}>
            <Text style={styles.measureLabel}>
              {t(`statistics.measures.${key}`)}
            </Text>
            <Text style={styles.measureValue}>{withUnit(measure[key])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action ? (
          <Pressable
            onPress={action.onPress}
            style={styles.sectionAction}
            accessibilityRole="button"
          >
            <Text style={styles.sectionActionText}>{action.label}</Text>
            <Icon
              name={action.icon ?? 'chevronRight'}
              size={11}
              color={COLORS.primary}
            />
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <Text style={styles.sectionHint} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function WardBarRow({
  label,
  count,
  maxCount,
  share,
  onPress,
}: {
  label: string;
  count: number;
  maxCount: number;
  /** Tỷ trọng 0..1 do API trả (ratio) — hiển thị cạnh số lượng. */
  share?: number;
  onPress?: () => void;
}) {
  // count 0 là số liệu thật -> thanh rỗng nhưng vẫn giữ dòng.
  const width =
    maxCount > 0 && count > 0 ? Math.max((count / maxCount) * 100, 4) : 0;
  return (
    <Pressable
      style={styles.wardRow}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Text style={styles.wardLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.wardBarTrack}>
        <View style={[styles.wardBarFill, { width: `${width}%` }]} />
      </View>
      <Text style={styles.wardValue}>
        {formatNumber(count)}
        {share !== undefined && share !== null
          ? `\n${formatPercent(share * 100, 2)}`
          : ''}
      </Text>
    </Pressable>
  );
}

function LayerRow({
  rank,
  icon,
  label,
  count,
  total,
  onPress,
}: {
  rank: number;
  icon: IconName;
  label: string;
  count: number;
  total: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.topLayerRow}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.topLayerRank}>
        <Text style={styles.topLayerRankText}>{rank}</Text>
      </View>
      <Icon name={icon} size={16} color={COLORS.textMuted} />
      <Text
        style={[styles.topLayerLabel, styles.topLayerInfo]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.topLayerNumbers}>
        <Text style={styles.topLayerCount}>{formatNumber(count)}</Text>
        {total > 0 ? (
          <Text style={styles.topLayerPercent}>
            {formatPercent((count / total) * 100)}
          </Text>
        ) : null}
      </View>
      <Icon name="chevronRight" size={14} color={COLORS.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.primaryDark },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  exportButtonText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  errorText: { fontSize: 13, color: COLORS.text, textAlign: 'center' },
  retryText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },

  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primaryDark,
  },
  totalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalTextCol: { flex: 1 },
  totalLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
  },
  totalValue: { fontSize: 26, fontWeight: '800', color: '#ffffff' },
  totalSubLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  notesBox: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningBg,
    gap: 4,
  },
  notesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notesTitle: { fontSize: 12, fontWeight: '700', color: COLORS.warningText },
  notesText: { fontSize: 11, lineHeight: 16, color: COLORS.warningText },

  mutedText: { fontSize: 11, color: COLORS.textFaint, marginTop: SPACING.xs },

  tileRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  statusTile: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: 4,
  },
  statusTileDot: { width: 8, height: 8, borderRadius: 4 },
  statusTileLabel: { fontSize: 10, color: COLORS.textMuted, minHeight: 26 },
  statusTileValue: { fontSize: 15, fontWeight: '800', color: COLORS.text },

  datePickerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  datePickerActionSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  datePickerActionSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  datePickerActionPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
  },
  datePickerActionPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },

  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  sectionHint: { fontSize: 10, color: COLORS.textFaint, marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sectionActionText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  statusBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    marginTop: SPACING.md,
  },
  legendCol: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 11, color: COLORS.textMuted },
  legendValue: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  legendTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  legendTotalLabel: { fontSize: 11, fontWeight: '800', color: COLORS.text },
  legendTotalValue: { fontSize: 11, fontWeight: '800', color: COLORS.text },

  emptyText: {
    fontSize: 11,
    color: COLORS.textFaint,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  wardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  wardLabel: { width: 96, fontSize: 11, color: COLORS.text },
  wardBarTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  wardBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  wardValue: {
    width: 60,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
  },
  unknownWardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  unknownWardLabel: { fontSize: 11, color: COLORS.textMuted },
  unknownWardValue: { fontSize: 11, fontWeight: '700', color: COLORS.text },

  trendLoading: { paddingVertical: SPACING.xl, alignItems: 'center' },

  dimensionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  dimensionChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dimensionChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dimensionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  dimensionChipTextActive: { color: '#ffffff' },
  fieldHint: { fontSize: 10, color: COLORS.textFaint, marginTop: SPACING.xs },

  topLayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  topLayerRank: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLayerRankText: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  topLayerInfo: { flex: 1 },
  topLayerLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  topLayerNumbers: { alignItems: 'flex-end' },
  topLayerCount: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  topLayerPercent: { fontSize: 10, color: COLORS.textFaint },

  measureBlock: { marginTop: SPACING.sm, gap: SPACING.xs },
  measureTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  measureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  measureCell: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  measureLabel: { fontSize: 10, color: COLORS.textMuted },
  measureValue: { fontSize: 13, fontWeight: '800', color: COLORS.text },
});
