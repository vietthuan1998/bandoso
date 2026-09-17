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
import { BottomSheet } from '../HueMapScreen/BottomSheet';
import { FilterChip, PickerOption } from '../HueMapScreen/FilterControls';
import { Icon, type IconName } from '../HueMapScreen/Icon';
import { CHART_WIDTH, COLORS, RADIUS, SPACING } from '../HueMapScreen/theme';
import { MVT_LAYERS } from '../../map/mvtLayers';
import { pad2 } from '../../map/normalizeFeatureFields';
import {
  computeWardScopedGroups,
  computeWardScopedStatus,
  fetchLayerAsOfCount,
  fetchStatisticsOverview,
  fetchTrend,
  fetchTrendForCollection,
  getLayerWardBreakdown,
  layerHasDateField,
  normalizeWardKey,
  type LayerFreshness,
  type StatisticsOverview,
  type TrendPoint,
  type WardBreakdownItem,
} from '../../map/statisticsOverview';
import { DonutChart } from './DonutChart';
import { TrendChart } from './TrendChart';
import { FRESHNESS_COLOR, FRESHNESS_ICON } from '../HueMapScreen/freshnessUi';

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}
function formatPercent(value: number): string {
  return `${value.toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}
function formatDateIso(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function formatTimestamp(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type TrendRange = 7 | 14 | 30;

export function StatisticsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [overview, setOverview] = useState<StatisticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null,
  );
  const [layerSheetOpen, setLayerSheetOpen] = useState(false);

  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [wardSheetOpen, setWardSheetOpen] = useState(false);

  const [asOfDate, setAsOfDate] = useState<string | null>(null);
  const [iosDatePickerOpen, setIosDatePickerOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState(() => new Date());

  const [topLayersExpanded, setTopLayersExpanded] = useState(false);

  const [trendRange, setTrendRange] = useState<TrendRange>(7);
  const [trendSheetOpen, setTrendSheetOpen] = useState(false);
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const [layerAsOf, setLayerAsOf] = useState<{
    count: number | null;
    maxUpdatedAt: string | null;
    freshness: LayerFreshness;
  } | null>(null);
  const [layerAsOfLoading, setLayerAsOfLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHasError(false);
    fetchStatisticsOverview()
      .then(result => {
        if (cancelled) return;
        setOverview(result);
        setTrendPoints(result.trend);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedLayerConfig = useMemo(
    () =>
      MVT_LAYERS.find(layer => layer.collection === selectedCollection) ?? null,
    [selectedCollection],
  );
  const selectedLayerId = selectedLayerConfig?.id ?? null;
  const selectedCollectionLabel = selectedLayerConfig
    ? t(selectedLayerConfig.labelKey)
    : '';

  const selectedWardKey = useMemo(
    () => (selectedWard ? normalizeWardKey(selectedWard) : null),
    [selectedWard],
  );

  const layerStat = useMemo(
    () =>
      selectedLayerId && overview
        ? overview.layerStats.find(s => s.layerId === selectedLayerId) ?? null
        : null,
    [overview, selectedLayerId],
  );

  useEffect(() => {
    if (!selectedLayerId || !selectedCollection || !asOfDate || selectedWard) {
      setLayerAsOf(null);
      return;
    }
    let cancelled = false;
    setLayerAsOfLoading(true);
    fetchLayerAsOfCount(selectedLayerId, selectedCollection, asOfDate)
      .then(result => {
        if (!cancelled) setLayerAsOf(result);
      })
      .finally(() => {
        if (!cancelled) setLayerAsOfLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLayerId, selectedCollection, asOfDate, selectedWard]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (selectedCollection && selectedLayerId) {
        if (!layerHasDateField(selectedLayerId)) {
          setTrendPoints([]);
          return;
        }
        setTrendLoading(true);
        try {
          const points = await fetchTrendForCollection(
            selectedCollection,
            trendRange,
            asOfDate,
          );
          if (!cancelled) setTrendPoints(points);
        } finally {
          if (!cancelled) setTrendLoading(false);
        }
        return;
      }
      if (!overview) return;
      if (trendRange === 7 && !asOfDate) {
        setTrendPoints(overview.trend);
        return;
      }
      setTrendLoading(true);
      try {
        const points = await fetchTrend(
          overview.layerStats,
          trendRange,
          asOfDate,
        );
        if (!cancelled) setTrendPoints(points);
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedCollection, selectedLayerId, overview, trendRange, asOfDate]);

  const selectedWardLabel = selectedWard
    ? overview?.wardBreakdown.find(w => w.fullName === selectedWard)?.ward ??
      selectedWard
    : t('statistics.filters.allWards');

  const dateLabel = asOfDate
    ? formatDateIso(asOfDate)
    : t('statistics.filters.today');

  const layerScopedCount = useMemo(() => {
    if (!overview || !selectedLayerId) return null;
    if (selectedWardKey) {
      return (
        overview.layerWardCounts.get(selectedLayerId)?.get(selectedWardKey) ?? 0
      );
    }
    if (asOfDate) return layerAsOf?.count ?? null;
    return layerStat?.count ?? null;
  }, [
    overview,
    selectedLayerId,
    selectedWardKey,
    asOfDate,
    layerAsOf,
    layerStat,
  ]);

  const layerScopedFreshness: LayerFreshness =
    !selectedWardKey && asOfDate && layerAsOf
      ? layerAsOf.freshness
      : layerStat?.freshness ?? 'unknown';
  const layerScopedMaxUpdatedAt =
    !selectedWardKey && asOfDate && layerAsOf
      ? layerAsOf.maxUpdatedAt
      : layerStat?.maxUpdatedAt ?? null;

  const layerWardItems = useMemo<WardBreakdownItem[]>(() => {
    if (!overview || !selectedLayerId) return [];
    const all = getLayerWardBreakdown(overview, selectedLayerId);
    if (selectedWard) return all.filter(w => w.fullName === selectedWard);
    return all.slice(0, 10);
  }, [overview, selectedLayerId, selectedWard]);
  const layerWardMax = useMemo(() => {
    if (!overview || !selectedLayerId) return 0;
    return getLayerWardBreakdown(overview, selectedLayerId)[0]?.count ?? 0;
  }, [overview, selectedLayerId]);

  // ===== Số liệu khi KHÔNG chọn lớp (Tất cả lớp), có thể có chọn phường/xã =====
  const allLayersScoped = useMemo(() => {
    if (!overview) return null;
    if (!selectedWardKey) {
      return {
        total: overview.totalRecords,
        buckets: overview.statusBuckets,
        groups: overview.groups,
      };
    }
    const { total, buckets } = computeWardScopedStatus(
      overview,
      selectedWardKey,
    );
    const groups = computeWardScopedGroups(overview, selectedWardKey);
    return { total, buckets, groups };
  }, [overview, selectedWardKey]);

  const visibleWardItems = useMemo(() => {
    if (!overview) return [];
    if (selectedWard) {
      return overview.wardBreakdown.filter(w => w.fullName === selectedWard);
    }
    return overview.wardBreakdown.slice(0, 5);
  }, [overview, selectedWard]);
  const wardMaxCount = overview?.wardBreakdown[0]?.count ?? 0;

  const topLayerGroups = useMemo(() => {
    if (!allLayersScoped) return [];
    return topLayersExpanded
      ? allLayersScoped.groups
      : allLayersScoped.groups.slice(0, 5);
  }, [allLayersScoped, topLayersExpanded]);

  function openDatePicker() {
    const currentValue = asOfDate
      ? new Date(`${asOfDate}T00:00:00`)
      : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentValue,
        mode: 'date',
        maximumDate: new Date(),
        onValueChange: (_event, selectedDate) => {
          const iso = toIsoDate(selectedDate);
          setAsOfDate(iso === toIsoDate(new Date()) ? null : iso);
        },
      });
      return;
    }
    setPendingDate(currentValue);
    setIosDatePickerOpen(true);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('statistics.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('statistics.loading')}</Text>
        </View>
      ) : hasError || !overview ? (
        <View style={styles.centerFill}>
          <Icon name="warning" size={22} color={COLORS.critical} />
          <Text style={styles.errorText}>{t('statistics.error')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}
        >
          <View style={styles.filterRow}>
            <FilterChip
              icon="database"
              label={
                selectedCollectionLabel || t('statistics.filters.allLayers')
              }
              onPress={() => setLayerSheetOpen(true)}
            />
            <FilterChip
              icon="pin"
              label={selectedWardLabel}
              onPress={() => setWardSheetOpen(true)}
            />
            <FilterChip
              icon="calendar"
              label={dateLabel}
              onPress={openDatePicker}
            />
          </View>

          {selectedCollection && selectedLayerId ? (
            <>
              <View style={styles.totalCard}>
                <View style={styles.totalIconWrap}>
                  <Icon name="database" size={22} color="#ffffff" />
                </View>
                <View style={styles.totalTextCol}>
                  <Text style={styles.totalLabel} numberOfLines={1}>
                    {selectedWard
                      ? `${selectedCollectionLabel} · ${selectedWardLabel}`
                      : selectedCollectionLabel}
                  </Text>
                  <Text style={styles.totalValue}>
                    {!selectedWardKey && asOfDate && layerAsOfLoading
                      ? '—'
                      : layerScopedCount === null
                      ? t('statistics.detail.unreadable')
                      : formatNumber(layerScopedCount)}
                  </Text>
                  <Text style={styles.totalSubLabel} numberOfLines={1}>
                    {selectedCollection}
                  </Text>
                </View>
              </View>

              <View style={styles.singleStatusRow}>
                <View
                  style={[
                    styles.singleStatusBadge,
                    {
                      backgroundColor: `${FRESHNESS_COLOR[layerScopedFreshness]}1f`,
                    },
                  ]}
                >
                  <Icon
                    name={FRESHNESS_ICON[layerScopedFreshness]}
                    size={12}
                    color={FRESHNESS_COLOR[layerScopedFreshness]}
                  />
                  <Text
                    style={[
                      styles.singleStatusText,
                      { color: FRESHNESS_COLOR[layerScopedFreshness] },
                    ]}
                  >
                    {t(`statistics.status.${layerScopedFreshness}`)}
                  </Text>
                </View>
                {layerScopedMaxUpdatedAt ? (
                  <Text style={styles.singleStatusMeta}>
                    {t('statistics.detail.lastUpdated', {
                      date: formatTimestamp(layerScopedMaxUpdatedAt),
                    })}
                  </Text>
                ) : null}
              </View>

              <Section
                title={t('statistics.ward.sectionTitle')}
                hint={t('statistics.ward.geometricNote')}
                action={
                  !selectedWard && layerWardItems.length > 0
                    ? undefined
                    : selectedWard
                    ? {
                        label: t('statistics.filters.allWards'),
                        onPress: () => setSelectedWard(null),
                      }
                    : undefined
                }
              >
                {layerWardItems.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {t('statistics.ward.empty')}
                  </Text>
                ) : (
                  layerWardItems.map(item => (
                    <WardBarRow
                      key={item.fullName}
                      label={item.ward}
                      count={item.count}
                      maxCount={layerWardMax}
                    />
                  ))
                )}
              </Section>

              <Section
                title={t('statistics.trend.sectionTitle')}
                hint={
                  selectedWard
                    ? t('statistics.trend.notWardFiltered')
                    : undefined
                }
                action={{
                  label: t(`statistics.trend.range${trendRange}` as const),
                  onPress: () => setTrendSheetOpen(true),
                  icon: 'chevronDown',
                }}
              >
                {trendLoading ? (
                  <View style={styles.trendLoading}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  </View>
                ) : !layerHasDateField(selectedLayerId) ? (
                  <Text style={styles.emptyText}>
                    {t('statistics.trend.notAvailable')}
                  </Text>
                ) : trendPoints.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {t('statistics.trend.empty')}
                  </Text>
                ) : (
                  <TrendChart points={trendPoints} width={CHART_WIDTH} />
                )}
              </Section>
            </>
          ) : (
            <>
              <View style={styles.totalCard}>
                <View style={styles.totalIconWrap}>
                  <Icon name="database" size={22} color="#ffffff" />
                </View>
                <View style={styles.totalTextCol}>
                  <Text style={styles.totalLabel}>
                    {selectedWard
                      ? `${t('statistics.totalCard')} · ${selectedWardLabel}`
                      : t('statistics.totalCard')}
                  </Text>
                  <Text style={styles.totalValue}>
                    {formatNumber(allLayersScoped?.total ?? 0)}
                  </Text>
                </View>
              </View>

              <View style={styles.tileRow}>
                {(allLayersScoped?.buckets ?? []).map(bucket => (
                  <StatusTile
                    key={bucket.freshness}
                    freshness={bucket.freshness}
                    count={bucket.recordCount}
                    percent={
                      allLayersScoped && allLayersScoped.total > 0
                        ? (bucket.recordCount / allLayersScoped.total) * 100
                        : 0
                    }
                    label={t(`statistics.status.${bucket.freshness}`)}
                  />
                ))}
              </View>

              <Section title={t('statistics.status.sectionTitle')}>
                <View style={styles.statusBody}>
                  <DonutChart
                    segments={(allLayersScoped?.buckets ?? []).map(b => ({
                      color: FRESHNESS_COLOR[b.freshness],
                      value: b.recordCount,
                    }))}
                  />
                  <View style={styles.legendCol}>
                    {(allLayersScoped?.buckets ?? []).map(bucket => (
                      <View key={bucket.freshness} style={styles.legendRow}>
                        <View
                          style={[
                            styles.legendDot,
                            {
                              backgroundColor:
                                FRESHNESS_COLOR[bucket.freshness],
                            },
                          ]}
                        />
                        <Text style={styles.legendLabel} numberOfLines={1}>
                          {t(`statistics.status.${bucket.freshness}`)}
                        </Text>
                        <Text style={styles.legendValue}>
                          {formatNumber(bucket.recordCount)} (
                          {formatPercent(
                            allLayersScoped && allLayersScoped.total > 0
                              ? (bucket.recordCount / allLayersScoped.total) *
                                  100
                              : 0,
                          )}
                          )
                        </Text>
                      </View>
                    ))}
                    <View style={styles.legendTotalRow}>
                      <Text style={styles.legendTotalLabel}>
                        {t('statistics.status.total')}
                      </Text>
                      <Text style={styles.legendTotalValue}>
                        {formatNumber(allLayersScoped?.total ?? 0)} (100%)
                      </Text>
                    </View>
                  </View>
                </View>
              </Section>

              <Section
                title={t('statistics.ward.sectionTitle')}
                hint={t('statistics.ward.geometricNote')}
                action={
                  !selectedWard && overview.wardBreakdown.length > 5
                    ? {
                        label: t('statistics.ward.viewAll', {
                          count: overview.wardBreakdown.length,
                        }),
                        onPress: () => setWardSheetOpen(true),
                      }
                    : selectedWard
                    ? {
                        label: t('statistics.filters.allWards'),
                        onPress: () => setSelectedWard(null),
                      }
                    : undefined
                }
              >
                {visibleWardItems.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {t('statistics.ward.empty')}
                  </Text>
                ) : (
                  visibleWardItems.map(item => (
                    <WardBarRow
                      key={item.fullName}
                      label={item.ward}
                      count={item.count}
                      maxCount={wardMaxCount}
                    />
                  ))
                )}
                {!selectedWard && overview.wardUnassignedCount > 0 ? (
                  <Text style={styles.wardUnassignedNote}>
                    + {formatNumber(overview.wardUnassignedCount)} ·{' '}
                    {t('statistics.ward.unassigned')}
                  </Text>
                ) : null}
              </Section>

              <Section
                title={t('statistics.trend.sectionTitle')}
                hint={
                  selectedWard
                    ? t('statistics.trend.notWardFiltered')
                    : t('statistics.trend.note')
                }
                action={{
                  label: t(`statistics.trend.range${trendRange}` as const),
                  onPress: () => setTrendSheetOpen(true),
                  icon: 'chevronDown',
                }}
              >
                {trendLoading ? (
                  <View style={styles.trendLoading}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  </View>
                ) : trendPoints.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {t('statistics.trend.empty')}
                  </Text>
                ) : (
                  <TrendChart points={trendPoints} width={CHART_WIDTH} />
                )}
              </Section>

              <Section
                title={t('statistics.topLayers.sectionTitle')}
                action={{
                  label: topLayersExpanded
                    ? t('statistics.topLayers.collapse')
                    : t('statistics.topLayers.viewAll'),
                  onPress: () => setTopLayersExpanded(v => !v),
                }}
              >
                {topLayerGroups.map((group, index) => (
                  <TopLayerRow
                    key={group.id}
                    rank={index + 1}
                    icon={group.icon}
                    label={t(group.labelKey)}
                    freshness={group.freshness}
                    freshnessLabel={
                      group.count === null
                        ? t('statistics.topLayers.unreadable')
                        : t(`statistics.status.${group.freshness}`)
                    }
                    count={group.count}
                    percent={group.percentOfTotal}
                  />
                ))}
              </Section>
            </>
          )}
        </ScrollView>
      )}

      <BottomSheet
        visible={layerSheetOpen}
        onClose={() => setLayerSheetOpen(false)}
        maxHeight={600}
      >
        <ScrollView>
          <PickerOption
            label={t('statistics.filters.allLayers')}
            active={selectedCollection === null}
            onPress={() => {
              setSelectedCollection(null);
              setLayerSheetOpen(false);
            }}
          />
          {MVT_LAYERS.map(layer => (
            <PickerOption
              key={layer.id}
              label={t(layer.labelKey)}
              active={selectedCollection === layer.collection}
              onPress={() => {
                setSelectedCollection(layer.collection);
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
            active={selectedWard === null}
            onPress={() => {
              setSelectedWard(null);
              setWardSheetOpen(false);
            }}
          />
          {overview?.wardBreakdown.map(item => (
            <PickerOption
              key={item.fullName}
              label={item.ward}
              hint={formatNumber(
                selectedLayerId
                  ? overview.layerWardCounts
                      .get(selectedLayerId)
                      ?.get(normalizeWardKey(item.fullName)) ?? 0
                  : item.count,
              )}
              active={selectedWard === item.fullName}
              onPress={() => {
                setSelectedWard(item.fullName);
                setWardSheetOpen(false);
              }}
            />
          ))}
        </ScrollView>
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
                setAsOfDate(null);
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
                setAsOfDate(iso === toIsoDate(new Date()) ? null : iso);
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

      <BottomSheet
        visible={trendSheetOpen}
        onClose={() => setTrendSheetOpen(false)}
        maxHeight={280}
      >
        {([7, 14, 30] as const).map(range => (
          <PickerOption
            key={range}
            label={t(`statistics.trend.range${range}` as const)}
            active={trendRange === range}
            onPress={() => {
              setTrendRange(range);
              setTrendSheetOpen(false);
            }}
          />
        ))}
      </BottomSheet>
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

function StatusTile({
  freshness,
  count,
  percent,
  label,
}: {
  freshness: LayerFreshness;
  count: number;
  percent: number;
  label: string;
}) {
  const color = FRESHNESS_COLOR[freshness];
  return (
    <View style={styles.statusTile}>
      <View style={[styles.statusTileIcon, { backgroundColor: `${color}1f` }]}>
        <Icon name={FRESHNESS_ICON[freshness]} size={14} color={color} />
      </View>
      <Text style={styles.statusTileLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.statusTileValue}>{formatNumber(count)}</Text>
      <Text style={[styles.statusTilePercent, { color }]}>
        {formatPercent(percent)}
      </Text>
    </View>
  );
}

function WardBarRow({
  label,
  count,
  maxCount,
}: {
  label: string;
  count: number;
  maxCount: number;
}) {
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 4) : 0;
  return (
    <View style={styles.wardRow}>
      <Text style={styles.wardLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.wardBarTrack}>
        <View style={[styles.wardBarFill, { width: `${width}%` }]} />
      </View>
      <Text style={styles.wardValue}>{formatNumber(count)}</Text>
    </View>
  );
}

function TopLayerRow({
  rank,
  icon,
  label,
  freshness,
  freshnessLabel,
  count,
  percent,
}: {
  rank: number;
  icon: IconName;
  label: string;
  freshness: LayerFreshness;
  freshnessLabel: string;
  count: number | null;
  percent: number;
}) {
  const color = FRESHNESS_COLOR[freshness];
  return (
    <View style={styles.topLayerRow}>
      <View style={styles.topLayerRank}>
        <Text style={styles.topLayerRankText}>{rank}</Text>
      </View>
      <Icon name={icon} size={16} color={COLORS.textMuted} />
      <View style={styles.topLayerInfo}>
        <Text style={styles.topLayerLabel} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.topLayerBadge, { backgroundColor: `${color}1f` }]}>
          <Text style={[styles.topLayerBadgeText, { color }]}>
            {freshnessLabel}
          </Text>
        </View>
      </View>
      <View style={styles.topLayerNumbers}>
        <Text style={styles.topLayerCount}>
          {count === null ? '—' : formatNumber(count)}
        </Text>
        <Text style={styles.topLayerPercent}>
          {count === null ? '' : formatPercent(percent)}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.primaryDark },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  errorText: { fontSize: 12, color: COLORS.critical, textAlign: 'center' },

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
  totalSubLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  tileRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statusTile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: SPACING.sm,
    gap: 4,
  },
  statusTileIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTileLabel: { fontSize: 10, color: COLORS.textMuted, minHeight: 26 },
  statusTileValue: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  statusTilePercent: { fontSize: 10, fontWeight: '700' },

  singleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  singleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  singleStatusText: { fontSize: 11, fontWeight: '700' },
  singleStatusMeta: { fontSize: 10, color: COLORS.textFaint, flex: 1 },

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
  wardUnassignedNote: {
    fontSize: 10,
    color: COLORS.textFaint,
    marginTop: SPACING.xs,
  },
  wardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  wardLabel: { width: 78, fontSize: 11, color: COLORS.text },
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
    width: 54,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
  },

  trendLoading: { paddingVertical: SPACING.xl, alignItems: 'center' },

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
  topLayerInfo: { flex: 1, gap: 3 },
  topLayerLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  topLayerBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  topLayerBadgeText: { fontSize: 9, fontWeight: '700' },
  topLayerNumbers: { alignItems: 'flex-end' },
  topLayerCount: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  topLayerPercent: { fontSize: 10, color: COLORS.textFaint },
});
