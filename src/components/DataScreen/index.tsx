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
import type { LayerFreshness } from '../../map/freshness';
import {
  DATA_SCREEN_LAYERS,
  WARD_TRACKED_LAYER_IDS,
  fetchAllLayersRecords,
  fetchDataRecordsPage,
  type DataRecord,
  type DataRecordsUnreadableReason,
  type MapLocateRequest,
} from '../../map/dataRecords';
import {
  normalizeFeatureFields,
  pad2,
  type NormalizedFeatureField,
  type NormalizedFeatureLeaf,
} from '../../map/normalizeFeatureFields';
import {
  extractRepresentativePoint,
  fetchWardDirectory,
  type WardBreakdownItem,
} from '../../map/statisticsOverview';
import { BottomSheet } from '../HueMapScreen/BottomSheet';
import { FeatureDetailScreen } from '../HueMapScreen/FeatureDetailScreen';
import { FilterChip, PickerOption } from '../HueMapScreen/FilterControls';
import { FRESHNESS_COLOR, FRESHNESS_ICON } from '../HueMapScreen/freshnessUi';
import { Icon } from '../HueMapScreen/Icon';
import { COLORS, RADIUS, SPACING } from '../HueMapScreen/theme';
import { DataRecordMiniMap, DataRecordMiniMapPlaceholder } from './MiniMap';

/**
 * Tab "Dữ liệu" — liệt kê/tìm kiếm TỪNG BẢN GHI thật của 14 collection MVT
 * nghiệp vụ (khác StatisticsScreen chỉ tổng hợp số lượng), theo bố cục
 * mota (ô tìm kiếm + 3 ô lọc + danh sách + popup chi tiết khi chọn 1 dòng).
 *
 * 3 Ô LỌC:
 *  - "Lớp" (collection) — 14 collection thật của DATA_SCREEN_LAYERS, mặc
 *    định "Tất cả lớp" (gộp 1 trang nhỏ từ mọi collection, xem
 *    fetchAllLayersRecords). Chọn đúng 1 lớp mới có phân trang "Tải thêm"
 *    đầy đủ (map/dataRecords.ts).
 *  - "Phường, xã" — 40 phường/xã thật, lấy qua fetchWardDirectory() (API
 *    RIÊNG, tách khỏi fetchStatisticsOverview() nặng — xem ghi chú tại
 *    fetchWardDirectory trong map/statisticsOverview.ts). Chỉ lọc CHÍNH XÁC
 *    được cho lớp có field ten_xa thật (hiện chỉ "Thửa đất", xem
 *    WARD_TRACKED_LAYER_IDS) — lớp khác hiện gợi ý wardUnsupportedHint thay
 *    vì lọc sai âm thầm.
 *  - "Trạng thái" — TẠM THỜI BỎ QUA theo yêu cầu: không có field trạng thái
 *    hoàn thành/lỗi dùng chung cho mọi collection (cùng lý do đã nêu ở đầu
 *    map/statisticsOverview.ts), nên ô này chỉ hiển thị, không lọc được gì —
 *    tránh dựng logic lọc trên dữ liệu không có thật.
 *
 * QUYỀN TRUY CẬP: một số collection gisportal_* (nhóm "Quy hoạch") trả 403
 * (tài khoản DCU_BEARER_TOKEN hiện chưa được cấp quyền đọc collection đó) —
 * map/dataRecords.ts phân biệt rõ "không đọc được" (unreadableReason) với
 * "đọc được nhưng 0 kết quả khớp bộ lọc" (total: 0), để không hiển thị nhầm
 * "Không có dữ liệu phù hợp" cho trường hợp thật ra là thiếu quyền.
 *
 * CHUẨN HOÁ DỮ LIỆU: mọi bản ghi đi qua map/dataRecords.ts#normalizeRecord —
 * dùng "danh sách khoá ứng viên" (pickFeatureTitle/pickFeatureWard) để suy ra
 * tiêu đề/phường-xã chung cho MỌI collection, không switch/case riêng từng
 * loại. Popup chi tiết dùng lại nguyên dữ liệu đã chuẩn hoá
 * (normalizeFeatureFields, cũng dùng cho MvtFeaturePanel/FeatureDetailScreen)
 * qua DetailField/DetailFieldListGroup riêng (bố cục nhãn/giá trị khác
 * FeatureFieldList, xem "làm đẹp popup"); nút "Xem chi tiết đầy đủ" mở thẳng
 * FeatureDetailScreen — không dựng lại toàn bộ UI chi tiết lần 2. Có thêm
 * DataRecordMiniMap (MiniMap.tsx) — bản đồ sống (KHÔNG tương tác, đặt cố
 * định NGOÀI vùng cuộn của popup — xem ghi chú ở đó) ghim đúng vị trí bản
 * ghi, quy về điểm trung tâm nếu bản ghi là 1 vùng (xem
 * extractRepresentativePoint).
 *
 * LƯU Ý: cùng 1 đối tượng có thể hiển thị KHÁC NHAU giữa panel trên bản đồ
 * (MvtFeaturePanel, đọc từ tile MVT — /mvt/{z}/{x}/{y}.mvt) và popup ở đây
 * (đọc thẳng từ Directus Items API — /items/<collection>, xem
 * fetchDataRecordsPage). Đây LÀ 2 NGUỒN DỮ LIỆU KHÁC NHAU (không phải lỗi
 * chuẩn hoá — cả 2 nơi dùng chung normalizeFeatureFields): tile MVT do server
 * tiền xử lý/đóng gói riêng cho việc vẽ bản đồ (có thể cache, có thể không
 * mang đủ mọi field), còn Items API luôn trả bản ghi gốc mới nhất.
 */

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
  /** Chuyển sang tab Bản đồ, bật lớp tương ứng, chọn đúng bản ghi rồi bay
   * camera tới toạ độ của nó — không bắt buộc; thiếu prop này thì nút
   * "Định vị trên bản đồ" không xuất hiện. */
  onLocateOnMap?: (request: MapLocateRequest) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    DATA_SCREEN_LAYERS[0]?.id ?? null,
  );
  const [layerSheetOpen, setLayerSheetOpen] = useState(false);
  const selectedLayer = useMemo(
    () =>
      DATA_SCREEN_LAYERS.find(layer => layer.id === selectedLayerId) ?? null,
    [selectedLayerId],
  );

  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [wardSheetOpen, setWardSheetOpen] = useState(false);
  const [wards, setWards] = useState<WardBreakdownItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchWardDirectory().then(items => {
      if (!cancelled) setWards(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const wardUnsupported =
    !!selectedWard &&
    !!selectedLayer &&
    !WARD_TRACKED_LAYER_IDS.has(selectedLayer.id);

  const [records, setRecords] = useState<DataRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  /** Chỉ có ý nghĩa khi đang chọn đúng 1 lớp — null nghĩa là gọi được (dù có
   * thể 0 kết quả khớp bộ lọc). Xem ghi chú "QUYỀN TRUY CẬP" ở đầu file. */
  const [unreadableReason, setUnreadableReason] =
    useState<DataRecordsUnreadableReason>(null);
  /** Chỉ có ý nghĩa ở chế độ "Tất cả lớp" — id các lớp gọi lỗi/403, bị loại
   * khỏi danh sách gộp thay vì làm hỏng cả danh sách. */
  const [unreadableLayerIds, setUnreadableLayerIds] = useState<string[]>([]);
  const requestKeyRef = useRef(0);
  /** Chặn loadMore gọi chồng — `onEndReached` của FlatList có thể bắn 2 lần
   * liên tiếp trong cùng 1 tick (đà cuộn) TRƯỚC KHI state `loadingMore`/
   * `page` kịp cập nhật qua re-render; đọc state trong closure lúc đó vẫn
   * thấy giá trị CŨ nên cả 2 lần gọi đều lọt qua guard, cùng fetch đúng 1
   * trang -> nối trùng bản ghi vào `records` -> key React trùng (đúng lỗi
   * "same key" đã gặp thật). Ref thay đổi ĐỒNG BỘ, không chờ re-render, nên
   * chặn được lần gọi thứ 2 ngay lập tức. */
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const key = ++requestKeyRef.current;
    setLoading(true);
    setHasError(false);
    setPage(1);
    (async () => {
      try {
        if (selectedLayer) {
          const result = await fetchDataRecordsPage({
            layer: selectedLayer,
            search: debouncedSearch,
            ward: selectedWard,
            page: 1,
            pageSize: PAGE_SIZE,
          });
          if (requestKeyRef.current !== key) return;
          setRecords(result.items);
          setTotal(result.total);
          setUnreadableReason(result.unreadableReason);
          setUnreadableLayerIds([]);
        } else {
          const result = await fetchAllLayersRecords({
            search: debouncedSearch,
            ward: selectedWard,
          });
          if (requestKeyRef.current !== key) return;
          setRecords(result.items);
          setTotal(result.total);
          setUnreadableReason(null);
          setUnreadableLayerIds(result.unreadableLayerIds);
        }
      } catch {
        if (requestKeyRef.current === key) setHasError(true);
      } finally {
        if (requestKeyRef.current === key) setLoading(false);
      }
    })();
  }, [selectedLayer, selectedWard, debouncedSearch]);

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
      ward: selectedWard,
      page: nextPage,
      pageSize: PAGE_SIZE,
    })
      .then(result => {
        if (requestKeyRef.current !== key) return;
        // Lọc bỏ bản ghi đã có sẵn (id trùng) trước khi nối trang mới — vừa
        // là lưới an toàn cho race ở guard trên, vừa chống trùng khi biên 2
        // trang chồng lấn (Directus sort theo date_updated không duy nhất
        // -> nhiều bản ghi cùng mốc giờ, thứ tự phân trang không đảm bảo ổn
        // định tuyệt đối giữa 2 lần gọi).
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
  const [fullDetailOpen, setFullDetailOpen] = useState(false);
  const detailLayer = useMemo(
    () =>
      detailRecord
        ? DATA_SCREEN_LAYERS.find(layer => layer.id === detailRecord.layerId) ??
          null
        : null,
    [detailRecord],
  );
  const detailCoordinates = useMemo(() => {
    if (!detailRecord) return null;
    const geom = detailRecord.properties.geom as
      | { type: string; coordinates: unknown }
      | null
      | undefined;
    return extractRepresentativePoint(geom);
  }, [detailRecord]);
  const detailFields = useMemo(() => {
    if (!detailRecord) return [];
    return normalizeFeatureFields(detailRecord.properties, {
      yes: t('common.yes'),
      no: t('common.no'),
      male: t('common.male'),
      female: t('common.female'),
    });
  }, [detailRecord, t]);

  const closeDetail = () => {
    setDetailRecord(null);
    setFullDetailOpen(false);
  };

  /** Gói tham số cho onLocateOnMap — luôn dùng layerId/properties của
   * detailRecord ĐANG XEM (không phải của record gốc chọn từ danh sách nếu
   * khác, dù thực tế luôn là cùng 1 bản ghi) để HueMapScreen bật đúng lớp và
   * chọn đúng đối tượng, không chỉ bay camera tới 1 điểm trống. */
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <FlatList
        data={records}
        // Kèm index làm khoá dự phòng — 1 số collection (gisportal_* thiếu
        // field khoá chính quen thuộc, xem ID_FIELD_CANDIDATES trong
        // map/dataRecords.ts) khiến nhiều bản ghi cùng rơi về id "" giống
        // nhau, mà chỉ ghép collection+id thì bị trùng khoá React ("two
        // children with the same key"). Vẫn ưu tiên item.id khi có (ổn định
        // qua các lần render/tải thêm), index chỉ dự phòng khi thiếu.
        keyExtractor={(item, index) => `${item.collection}-${item.id || index}`}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xl }}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        renderItem={({ item }) => (
          <DataRecordCard record={item} onPress={() => setDetailRecord(item)} />
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
                onChangeText={setSearch}
                placeholder={t('dataScreen.searchPlaceholder')}
                placeholderTextColor={COLORS.textFaint}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {search ? (
                <Pressable
                  onPress={() => setSearch('')}
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
                label={
                  selectedLayer
                    ? t(selectedLayer.labelKey)
                    : t('statistics.filters.allLayers')
                }
                onPress={() => setLayerSheetOpen(true)}
              />
              <FilterChip
                icon="pin"
                label={selectedWard ?? t('statistics.filters.allWards')}
                onPress={() => setWardSheetOpen(true)}
              />
              <FilterChip
                icon="status"
                label={t('dataScreen.filters.status')}
                disabled
              />
            </View>

            {wardUnsupported ? (
              <Text style={styles.hintText}>
                {t('dataScreen.wardUnsupportedHint')}
              </Text>
            ) : null}

            {!selectedLayer && !loading && unreadableLayerIds.length > 0 ? (
              <Text style={styles.hintText}>
                {t('dataScreen.unreadableLayersHint', {
                  count: unreadableLayerIds.length,
                })}
              </Text>
            ) : null}

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

      {/* Sheet chọn lớp/collection — "Tất cả lớp" + 14 collection thật. */}
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
          {DATA_SCREEN_LAYERS.map(layer => (
            <PickerOption
              key={layer.id}
              label={t(layer.labelKey)}
              active={selectedLayerId === layer.id}
              onPress={() => {
                setSelectedLayerId(layer.id);
                setLayerSheetOpen(false);
              }}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Sheet chọn phường/xã — 40 phường/xã thật lấy qua fetchWardDirectory(). */}
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
          {wards.map(item => (
            <PickerOption
              key={item.fullName}
              label={item.ward}
              active={selectedWard === item.fullName}
              onPress={() => {
                setSelectedWard(item.fullName);
                setWardSheetOpen(false);
              }}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      {/* Popup "Chi tiết dữ liệu" khi chọn 1 dòng trong danh sách — có mini
          bản đồ định vị ở đầu (ghim đúng toạ độ, hoặc điểm trung tâm nếu bản
          ghi là 1 vùng/polygon, xem extractRepresentativePoint), theo đúng
          bố cục mota. */}
      <BottomSheet
        visible={!!detailRecord && !fullDetailOpen}
        onClose={closeDetail}
        maxHeight={680}
      >
        {detailRecord && detailLayer ? (
          <>
            {/* Thanh tiêu đề + mini bản đồ CỐ ĐỊNH, đặt NGOÀI ScrollView bên
                dưới — <Map> sống là 1 bề mặt native riêng (SurfaceView trên
                Android), không bị cắt bởi overflow:hidden khi nằm trong vùng
                cuộn (đã gặp thật: vuốt danh sách thuộc tính làm bản đồ "tràn"
                ra ngoài khung). Đặt cố định ở đây thì bản đồ không di chuyển
                khi vuốt, không còn gì để tràn — xem thêm ghi chú ở MiniMap.tsx. */}
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
                    {detailRecord.title}
                  </Text>
                  <Text style={styles.detailSubtitle} numberOfLines={1}>
                    {t(detailLayer.labelKey)}
                  </Text>
                </View>
              </View>

              {detailRecord.status !== 'unknown' ||
              detailRecord.ward ||
              detailRecord.updatedAt ? (
                <View style={styles.detailMetaRow}>
                  {detailRecord.status !== 'unknown' ? (
                    <StatusBadge
                      status={detailRecord.status}
                      label={t(`statistics.status.${detailRecord.status}`)}
                    />
                  ) : null}
                  {detailRecord.ward ? (
                    <View style={styles.metaChip}>
                      <Icon name="pin" size={11} color={COLORS.textMuted} />
                      <Text style={styles.metaChipText} numberOfLines={1}>
                        {detailRecord.ward}
                      </Text>
                    </View>
                  ) : null}
                  {detailRecord.updatedAt ? (
                    <View style={styles.metaChip}>
                      <Icon
                        name="calendar"
                        size={11}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.metaChipText} numberOfLines={1}>
                        {formatDateTime(detailRecord.updatedAt)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

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

              <View style={styles.detailFooterRow}>
                {detailCoordinates && onLocateOnMap ? (
                  <Pressable
                    onPress={() => {
                      const request = locateRequestFor(detailCoordinates);
                      if (request) onLocateOnMap(request);
                      closeDetail();
                    }}
                    style={styles.detailButtonSecondary}
                    accessibilityRole="button"
                  >
                    <Icon name="pin" size={14} color={COLORS.primaryDark} />
                    <Text style={styles.detailButtonSecondaryText}>
                      {t('featureDetail.locateButton')}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setFullDetailOpen(true)}
                  style={styles.detailButtonPrimary}
                  accessibilityRole="button"
                >
                  <Text style={styles.detailButtonPrimaryText}>
                    {t('dataScreen.detail.viewFull')}
                  </Text>
                  <Icon name="chevronRight" size={13} color="#ffffff" />
                </Pressable>
              </View>
            </ScrollView>
          </>
        ) : null}
      </BottomSheet>

      {/* Trang chi tiết đầy đủ — dùng lại nguyên FeatureDetailScreen (đã có
          sẵn cho HueMapScreen), không dựng lại lần 2. */}
      {detailRecord && detailLayer && fullDetailOpen ? (
        <FeatureDetailScreen
          layer={detailLayer}
          properties={detailRecord.properties}
          coordinates={detailCoordinates}
          onBack={() => setFullDetailOpen(false)}
          onLocate={coordinates => {
            const request = locateRequestFor(coordinates);
            closeDetail();
            if (request) onLocateOnMap?.(request);
          }}
        />
      ) : null}
    </View>
  );
}

function DataRecordCard({
  record,
  onPress,
}: {
  record: DataRecord;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.cardIcon,
          { backgroundColor: record.color, shadowColor: record.color },
        ]}
      >
        <Icon name="database" size={18} color="#ffffff" />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {record.title}
          </Text>
          {record.status !== 'unknown' ? (
            <StatusBadge
              status={record.status}
              label={t(`statistics.status.${record.status}`)}
              compact
            />
          ) : null}
        </View>

        <View
          style={[
            styles.cardLayerPill,
            { backgroundColor: `${record.color}14` },
          ]}
        >
          <Text
            style={[styles.cardLayerPillText, { color: record.color }]}
            numberOfLines={1}
          >
            {t(record.layerLabelKey)}
          </Text>
        </View>

        {record.ward || record.updatedAt ? (
          <View style={styles.cardMetaCol}>
            {record.ward ? (
              <View style={styles.cardMetaRow}>
                <Icon name="pin" size={11} color={COLORS.textFaint} />
                <Text style={styles.cardMetaText} numberOfLines={1}>
                  {record.ward}
                </Text>
              </View>
            ) : null}
            {record.updatedAt ? (
              <View style={styles.cardMetaRow}>
                <Icon name="calendar" size={11} color={COLORS.textFaint} />
                <Text style={styles.cardMetaText} numberOfLines={1}>
                  {formatDateTime(record.updatedAt)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.cardChevronWrap}>
        <Icon name="chevronRight" size={18} color={COLORS.textFaint} />
      </View>
    </Pressable>
  );
}

function StatusBadge({
  status,
  label,
  compact,
}: {
  status: LayerFreshness;
  label: string;
  compact?: boolean;
}) {
  const color = FRESHNESS_COLOR[status];
  return (
    <View
      style={[
        styles.badge,
        compact ? styles.badgeCompact : null,
        { backgroundColor: `${color}1f` },
      ]}
    >
      <Icon
        name={FRESHNESS_ICON[status]}
        size={compact ? 10 : 12}
        color={color}
      />
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * 1 dòng thuộc tính trong popup chi tiết — nhãn bên trái, giá trị canh phải
 * cùng dòng (đủ chỗ co giãn cho giá trị dài), đường kẻ mảnh phía dưới trừ
 * dòng cuối. Field dạng "list" (vd. nhiều đồng sở hữu) render thành khối
 * riêng (DetailFieldListGroup) thay vì 1 dòng đơn.
 */
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
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm + 2,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surface,
    // Bóng đổ mềm để mỗi dòng nổi thành 1 "thẻ" thật sự thay vì chỉ có viền
    // phẳng — cùng tông màu bóng (#0f2c47) đang dùng cho BottomSheet/InfoCard
    // trong app, giữ nhất quán ngôn ngữ thị giác.
    shadowColor: '#0f2c47',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  // Phản hồi chạm rõ ràng hơn — nền hơi tối lại và tắt bóng đổ khi đang nhấn
  // (giữ opacity mặc định của Pressable là chưa đủ rõ trên nền trắng).
  cardPressed: { backgroundColor: COLORS.background, shadowOpacity: 0 },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    // Bóng đổ NHUỘM MÀU theo chính layer (shadowColor gán động = record.color
    // ở nơi dùng) — làm rõ sắc thái riêng của từng lớp dữ liệu ngay từ icon,
    // nhất quán với bảng màu MVT_LAYERS thay vì 1 bóng xám dùng chung.
    shadowOpacity: 0.35,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 18,
  },
  cardLayerPill: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardLayerPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardMetaCol: { gap: 2, marginTop: 1 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { flex: 1, fontSize: 11, color: COLORS.textMuted },
  // alignSelf: 'center' căn mũi tên theo chiều dọc TOÀN BỘ dòng (card dùng
  // alignItems: 'flex-start' để icon/nội dung neo lên đầu khi có nhiều dòng
  // meta) — không để mũi tên dính cứng lên đầu dòng khi card cao.
  cardChevronWrap: { alignSelf: 'center' },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  badgeCompact: { paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  // Khối cố định (tiêu đề popup + mini bản đồ) — đặt NGOÀI ScrollView bên
  // dưới, xem ghi chú tại nơi dùng trong JSX + đầu MiniMap.tsx.
  detailFixedHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.md,
  },
  // Chiều cao GIỚI HẠN CỤ THỂ (không chỉ flex:1) cho vùng cuộn — tránh phụ
  // thuộc vào cách Yoga tự co giãn ScrollView khi nó không còn là con DUY
  // NHẤT của sheet (giờ có thêm detailFixedHeader phía trên); một con số cụ
  // thể đảm bảo chắc chắn cuộn được bất kể chi tiết co giãn mặc định.
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
  detailButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailButtonSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
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
