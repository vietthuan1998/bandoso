import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMapRegistry } from '../../services/map/mapRegistry';
import {
  dataScreenLayers,
  fetchDataRecordsPage,
  type DataFilters,
  type DataRecord,
  type DataRecordsUnreadableReason,
  type LayerFilterSupport,
  type MapLocateRequest,
} from '../../services/api/dataRecords';
import {
  fetchCatalogWards,
  type CatalogWard,
} from '../../services/api/catalogApi';
import {
  pad2,
  type NormalizedFeatureField,
  type NormalizedFeatureLeaf,
} from '../../services/gis/normalizeFeatureFields';
import { extractRepresentativePoint } from '../../services/statistics/statisticsOverview';
import { BottomSheet } from '../../components/common/BottomSheet';
import { IotReadingsPanel } from '../../components/feature/IotReadingsPanel';
import {
  buildFeatureDetailFields,
  resolveFeatureTitle,
} from '../../services/gis/registryFeatureFields';
import {
  FilterChip,
  PickerOption,
} from '../../components/filter/FilterControls';
import {
  DateRangeSheet,
  WardFilterSheet,
  dateRangeLabel,
  wardFilterLabel,
} from '../../components/filter/FilterSheets';
import { useSharedFilters } from '../../hooks/useSharedFilters';
import { useAuthProfile } from '../../hooks/useAuthProfile';
import { Icon } from '../../components/common/Icon';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import {
  DataRecordMiniMap,
  DataRecordMiniMapPlaceholder,
} from '../../components/map/MiniMap';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getDate())}/${pad2(
    d.getMonth() + 1,
  )}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function DataScreen({
  onLocateOnMap,
}: {
  onLocateOnMap?: (request: MapLocateRequest) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const profile = useAuthProfile();
  const labels = useMemo(
    () => ({
      yes: t('common.yes'),
      no: t('common.no'),
      male: t('common.male'),
      female: t('common.female'),
    }),
    [t],
  );

  // Bộ lọc dùng chung với màn Thống kê, giữ nguyên khi chuyển tab.
  const { filters: shared, updateFilters } = useSharedFilters();
  const search = shared.search;
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const registry = useMapRegistry();
  const layers = useMemo(
    () => dataScreenLayers(registry.layers),
    [registry.layers],
  );
  // Registry chưa tải xong thì chưa gọi dữ liệu.
  const registryPending =
    registry.status === 'idle' ||
    (registry.status === 'loading' && registry.layers.length === 0);
  // Luôn xem một lớp: lớp đang chọn trong bộ lọc chung nếu màn Dữ liệu hiển
  // thị được, không thì lớp đầu tiên registry trả về (chỉ để hiển thị, không
  // ghi vào bộ lọc chung — màn Thống kê vẫn hiểu rỗng là tất cả lớp).
  const pickedLayerId = shared.collections[0];
  const selectedLayerId =
    (pickedLayerId && layers.some(layer => layer.id === pickedLayerId)
      ? pickedLayerId
      : layers[0]?.id) ?? null;
  const [layerSheetOpen, setLayerSheetOpen] = useState(false);
  const selectedLayer = useMemo(
    () => layers.find(layer => layer.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );
  const layerById = useMemo(
    () => new Map(layers.map(layer => [layer.id, layer])),
    [layers],
  );

  const [wardSheetOpen, setWardSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [wardCatalog, setWardCatalog] = useState<CatalogWard[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchCatalogWards().then(
      items => {
        if (!cancelled) setWardCatalog(items);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const filters = useMemo<DataFilters>(
    () => ({
      wards: shared.wards,
      dateFrom: shared.dateFrom,
      dateTo: shared.dateTo,
    }),
    [shared.wards, shared.dateFrom, shared.dateTo],
  );

  const [records, setRecords] = useState<DataRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [unreadableReason, setUnreadableReason] =
    useState<DataRecordsUnreadableReason>(null);
  const [unsupported, setUnsupported] = useState<LayerFilterSupport | null>(
    null,
  );
  const requestKeyRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const key = ++requestKeyRef.current;
    setLoading(true);
    setHasError(false);
    setPage(1);
    if (registryPending) return;
    if (registry.status === 'error') {
      setHasError(true);
      setLoading(false);
      return;
    }
    if (!selectedLayer) {
      // Registry không có lớp nào hiển thị được ở màn Dữ liệu.
      setRecords([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const result = await fetchDataRecordsPage({
          layer: selectedLayer,
          search: debouncedSearch,
          filters,
          labels,
          page: 1,
          pageSize: PAGE_SIZE,
        });
        if (requestKeyRef.current !== key) return;
        setRecords(result.items);
        setTotal(result.total);
        setUnreadableReason(result.unreadableReason);
        setUnsupported(result.unsupported);
      } catch {
        if (requestKeyRef.current === key) setHasError(true);
      } finally {
        if (requestKeyRef.current === key) setLoading(false);
      }
    })();
  }, [
    selectedLayer,
    filters,
    labels,
    debouncedSearch,
    registryPending,
    registry.status,
  ]);

  const canLoadMore = !!selectedLayer && !loading && records.length < total;
  const loadMore = () => {
    if (!selectedLayer || loading || loadingMoreRef.current || !canLoadMore) {
      return;
    }
    loadingMoreRef.current = true;
    const nextPage = page + 1;
    const key = requestKeyRef.current;
    setLoadingMore(true);
    fetchDataRecordsPage({
      layer: selectedLayer,
      search: debouncedSearch,
      filters,
      labels,
      page: nextPage,
      pageSize: PAGE_SIZE,
    })
      .then(result => {
        if (requestKeyRef.current !== key) return;
        setRecords(prev => {
          const existingIds = new Set(
            prev.map(item => item.id).filter(Boolean),
          );
          const fresh = result.items.filter(
            item => !item.id || !existingIds.has(item.id),
          );
          return [...prev, ...fresh];
        });
        setPage(nextPage);
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  };

  const [detailRecord, setDetailRecord] = useState<DataRecord | null>(null);
  const detailLayer = useMemo(
    () =>
      detailRecord
        ? layers.find(layer => layer.id === detailRecord.layerId) ?? null
        : null,
    [layers, detailRecord],
  );
  const detailCoordinates = useMemo(() => {
    if (!detailRecord || !detailLayer) return null;
    const geom = detailRecord.properties[detailLayer.geometryField] as
      | { type: string; coordinates: unknown }
      | null
      | undefined;
    return extractRepresentativePoint(geom);
  }, [detailRecord, detailLayer]);
  // Cùng cách dựng với panel khi chạm trên bản đồ (MvtFeaturePanel): theo
  // registry detailFields / fieldLabels / valueLabels / objectValueKeys.
  const detailFields = useMemo(() => {
    if (!detailRecord || !detailLayer) return [];
    return buildFeatureDetailFields(
      detailLayer,
      detailRecord.properties,
      labels,
    );
  }, [detailRecord, detailLayer, labels]);
  const detailTitle =
    detailRecord && detailLayer
      ? resolveFeatureTitle(detailLayer, detailRecord.properties)
      : '';

  const closeDetail = () => {
    setDetailRecord(null);
  };

  const locateRequestFor = (
    coordinates: [number, number],
  ): MapLocateRequest | null =>
    detailRecord
      ? {
          layerId: detailRecord.layerId,
          coordinates,
          properties: detailRecord.properties,
        }
      : null;

  const unsupportedHints = unsupported
    ? [
        !unsupported.wards ? t('dataScreen.wardUnsupportedHint') : null,
        !unsupported.dates ? t('dataScreen.dateUnsupportedHint') : null,
        !unsupported.search ? t('dataScreen.searchUnsupportedHint') : null,
      ].filter((hint): hint is string => !!hint)
    : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        data={records}
        keyExtractor={(item, index) => `${item.collection}-${item.id || index}`}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        renderItem={({ item }) => (
          <DataRecordCard
            record={item}
            // Registry tắt capabilities.detail -> không mở chi tiết.
            onPress={
              layerById.get(item.layerId)?.capabilities.detail === false
                ? undefined
                : () => setDetailRecord(item)
            }
          />
        )}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('dataScreen.title')}</Text>
            </View>

            <View style={styles.searchBox}>
              <Icon name="search" size={16} color={COLORS.textFaint} />
              <TextInput
                value={search}
                onChangeText={value => updateFilters({ search: value })}
                placeholder={t('dataScreen.searchPlaceholder')}
                placeholderTextColor={COLORS.textFaint}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {search ? (
                <Pressable
                  onPress={() => updateFilters({ search: '' })}
                  hitSlop={8}
                  accessibilityLabel={t('header.clearSearch')}
                >
                  <Icon name="close" size={15} color={COLORS.textFaint} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.filterRow}>
              <FilterChip
                icon="database"
                label={selectedLayer?.label ?? ''}
                onPress={() => setLayerSheetOpen(true)}
              />
              <FilterChip
                icon="pin"
                label={wardFilterLabel(shared.wards, wardCatalog, t, profile)}
                onPress={() => setWardSheetOpen(true)}
              />
              <FilterChip
                icon="calendar"
                label={dateRangeLabel(shared.dateFrom, shared.dateTo, t)}
                onPress={() => setDateSheetOpen(true)}
              />
            </View>

            {unsupportedHints.map(hint => (
              <Text key={hint} style={styles.hintText}>
                {hint}
              </Text>
            ))}

            {!loading && !hasError ? (
              <Text style={styles.resultCountText}>
                {t('dataScreen.resultCount', { count: total })}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerFill}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>{t('dataScreen.loading')}</Text>
            </View>
          ) : hasError ? (
            <View style={styles.centerFill}>
              <Icon name="warning" size={20} color={COLORS.critical} />
              <Text style={styles.errorText}>{t('dataScreen.error')}</Text>
            </View>
          ) : selectedLayer && unreadableReason ? (
            // Khác "không có dữ liệu phù hợp" — collection này gọi lỗi
            // (thường là 403 do chưa được cấp quyền, xem gisportal_* ở đầu
            // file), cần báo đúng nguyên nhân thay vì trông như "trống".
            <View style={styles.centerFill}>
              <Icon name="warning" size={20} color={COLORS.warn} />
              <Text style={styles.emptyTitle}>
                {t('dataScreen.unreadableTitle')}
              </Text>
              <Text style={styles.emptyMessage}>
                {t('dataScreen.unreadableMessage')}
              </Text>
            </View>
          ) : (
            <View style={styles.centerFill}>
              <Icon name="info" size={20} color={COLORS.textFaint} />
              <Text style={styles.emptyTitle}>
                {t('dataScreen.emptyTitle')}
              </Text>
              <Text style={styles.emptyMessage}>
                {t('dataScreen.emptyMessage')}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={COLORS.primary} size="small" />
            </View>
          ) : undefined
        }
      />

      {/* Sheet chọn lớp — mỗi lần xem một lớp của registry. */}
      <BottomSheet
        visible={layerSheetOpen}
        onClose={() => setLayerSheetOpen(false)}
        maxHeight={600}
      >
        <ScrollView>
          {layers.map(layer => (
            <PickerOption
              key={layer.id}
              label={layer.label}
              active={selectedLayerId === layer.id}
              onPress={() => {
                updateFilters({ collections: [layer.id] });
                setLayerSheetOpen(false);
              }}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Phường xã theo mã ĐVHC từ /catalog/wards — không dùng tên làm khoá. */}
      <WardFilterSheet
        visible={wardSheetOpen}
        onClose={() => setWardSheetOpen(false)}
        wards={wardCatalog}
        selected={shared.wards}
        onChange={wards => updateFilters({ wards })}
      />

      <DateRangeSheet
        visible={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        dateFrom={shared.dateFrom}
        dateTo={shared.dateTo}
        onChange={range => updateFilters(range)}
      />

      <BottomSheet
        visible={!!detailRecord}
        onClose={closeDetail}
        maxHeight={680}
      >
        {detailRecord && detailLayer ? (
          <>
            <View style={styles.detailFixedHeader}>
              <View style={styles.detailTopRow}>
                <Text style={styles.detailSheetTitle}>
                  {t('dataScreen.detail.title')}
                </Text>
                <Pressable
                  onPress={closeDetail}
                  hitSlop={10}
                  style={styles.detailCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                >
                  <Icon name="close" size={15} color={COLORS.textMuted} />
                </Pressable>
              </View>

              {detailCoordinates ? (
                <DataRecordMiniMap
                  coordinates={detailCoordinates}
                  color={detailLayer.color}
                />
              ) : (
                <DataRecordMiniMapPlaceholder
                  message={t('dataScreen.detail.noCoordinates')}
                />
              )}
            </View>

            <ScrollView
              style={styles.detailScroll}
              contentContainerStyle={styles.detailBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailHeaderRow}>
                <View
                  style={[
                    styles.detailIcon,
                    { backgroundColor: detailLayer.color },
                  ]}
                >
                  <Icon name="database" size={20} color="#ffffff" />
                </View>
                <View style={styles.detailTitleCol}>
                  <Text style={styles.detailTitle} numberOfLines={2}>
                    {detailTitle}
                  </Text>
                  <Text style={styles.detailSubtitle} numberOfLines={1}>
                    {detailLayer.label}
                  </Text>
                </View>
              </View>

              {detailRecord.updatedAt ? (
                <View style={styles.detailMetaRow}>
                  <View style={styles.metaChip}>
                    <Icon name="calendar" size={11} color={COLORS.textMuted} />
                    <Text style={styles.metaChipText} numberOfLines={1}>
                      {formatDateTime(detailRecord.updatedAt)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Trạm IoT: chỉ số + biểu đồ đo đạc lấy từ Directus (lớp khác không hiện). */}
              <IotReadingsPanel
                layerId={detailLayer.id}
                properties={detailRecord.properties}
                color={detailLayer.color}
              />

              <View style={styles.fieldsCard}>
                {detailFields.length === 0 ? (
                  <Text style={styles.emptyMessage}>
                    {t('mvt.noAttributes')}
                  </Text>
                ) : (
                  detailFields.map((field, index) => (
                    <DetailField
                      key={field.key}
                      field={field}
                      last={index === detailFields.length - 1}
                    />
                  ))
                )}
              </View>

              {detailCoordinates && onLocateOnMap ? (
                <View style={styles.detailFooterRow}>
                  <Pressable
                    onPress={() => {
                      const request = locateRequestFor(detailCoordinates);
                      if (request) onLocateOnMap(request);
                      closeDetail();
                    }}
                    style={styles.detailButtonPrimary}
                    accessibilityRole="button"
                  >
                    <Icon name="pin" size={14} color="#ffffff" />
                    <Text style={styles.detailButtonPrimaryText}>
                      {t('featureDetail.locateButton')}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function DataRecordCard({
  record,
  onPress,
}: {
  record: DataRecord;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[styles.cardIcon, { backgroundColor: record.color }]}>
        <Icon name="database" size={16} color="#ffffff" />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {record.title}
        </Text>

        {/* Cột theo listFields của registry (tài liệu mục 4). */}
        {record.lines.slice(0, 3).map(line => (
          <Text key={line.key} style={styles.cardLineText} numberOfLines={1}>
            <Text style={styles.cardLineLabel}>{line.label}: </Text>
            {line.value}
          </Text>
        ))}

        {record.updatedAt ? (
          <View style={styles.cardMetaRow}>
            <Icon name="calendar" size={11} color={COLORS.textFaint} />
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {formatDateTime(record.updatedAt)}
            </Text>
          </View>
        ) : null}
      </View>
      {onPress ? (
        <View style={styles.cardChevronWrap}>
          <Icon name="chevronRight" size={18} color={COLORS.textFaint} />
        </View>
      ) : null}
    </Pressable>
  );
}

function DetailField({
  field,
  last,
}: {
  field: NormalizedFeatureField;
  last: boolean;
}) {
  if (field.kind === 'list') {
    return (
      <DetailFieldListGroup
        label={field.label}
        items={field.items}
        last={last}
      />
    );
  }
  return (
    <View style={[styles.fieldRow, last ? styles.fieldRowLast : null]}>
      <Text style={styles.fieldLabel} numberOfLines={1}>
        {field.label}
      </Text>
      <Text style={styles.fieldValue}>{field.value}</Text>
    </View>
  );
}

function DetailFieldListGroup({
  label,
  items,
  last,
}: {
  label: string;
  items: NormalizedFeatureLeaf[][];
  last: boolean;
}) {
  return (
    <View style={[styles.fieldListGroup, last ? styles.fieldRowLast : null]}>
      <Text style={styles.fieldListLabel}>{label}</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.fieldListCard}>
          {item.map(leaf => (
            <View key={leaf.key} style={styles.fieldListItemRow}>
              <Text style={styles.fieldListItemLabel}>{leaf.label}</Text>
              <Text style={styles.fieldListItemValue}>{leaf.value}</Text>
            </View>
          ))}
        </View>
      ))}
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    height: 42,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },

  filterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },

  hintText: {
    fontSize: 11,
    color: COLORS.textFaint,
    fontStyle: 'italic',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  resultCountText: {
    fontSize: 10,
    color: COLORS.textFaint,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },

  centerFill: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl * 2,
  },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  errorText: { fontSize: 12, color: COLORS.critical, textAlign: 'center' },
  emptyTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  emptyMessage: { fontSize: 11, color: COLORS.textFaint, textAlign: 'center' },
  footerLoading: { paddingVertical: SPACING.lg, alignItems: 'center' },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    backgroundColor: COLORS.surface,
  },
  cardPressed: { backgroundColor: COLORS.background },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 18,
  },
  cardLineText: { fontSize: 12, color: COLORS.textMuted },
  cardLineLabel: { color: COLORS.textFaint },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  cardMetaText: { flex: 1, fontSize: 11, color: COLORS.textMuted },
  // alignSelf: 'center' căn mũi tên theo chiều dọc TOÀN BỘ dòng (card dùng
  // alignItems: 'flex-start' để icon/nội dung neo lên đầu khi có nhiều dòng
  // meta) — không để mũi tên dính cứng lên đầu dòng khi card cao.
  cardChevronWrap: { alignSelf: 'center' },

  // Khối cố định (tiêu đề popup + mini bản đồ) — đặt NGOÀI ScrollView bên
  // dưới, xem ghi chú tại nơi dùng trong JSX + đầu MiniMap.tsx.
  detailFixedHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  detailScroll: { maxHeight: 430 },
  detailBody: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  detailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailSheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailCloseButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef3f7',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  detailIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitleCol: { flex: 1 },
  detailTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  detailSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    backgroundColor: COLORS.background,
  },
  metaChipText: { fontSize: 11, color: COLORS.textMuted, maxWidth: 180 },

  fieldsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  fieldRowLast: { borderBottomWidth: 0 },
  fieldLabel: { fontSize: 12, color: COLORS.textMuted, maxWidth: '42%' },
  fieldValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'right',
  },
  fieldListGroup: {
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  fieldListLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: COLORS.textFaint,
    marginBottom: 6,
  },
  fieldListCard: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    marginBottom: 6,
    gap: 2,
  },
  fieldListItemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  fieldListItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  fieldListItemValue: { fontSize: 11, color: COLORS.text, flexShrink: 1 },

  detailFooterRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  detailButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary,
  },
  detailButtonPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
