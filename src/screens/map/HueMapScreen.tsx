import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import {
  changeAppLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../../i18n';
import { appLanguage, getLocalizedDataValue } from '../../i18n/localizedData';
import { normalizeWard, useHueMap } from '../../hooks/useHueMap';
import type { Ward } from '../../types/map';
import { useMapRegistry } from '../../services/map/mapRegistry';
import type { MvtLayerConfig } from '../../services/map/mvtLayers';
import {
  fetchDataRecordsPage,
  fetchFeatureRecord,
  type DataRecord,
  type MapLocateRequest,
} from '../../services/api/dataRecords';
import { getFeatureId } from '../../services/gis/registryFeatureFields';
import { extractRepresentativePoint } from '../../services/statistics/statisticsOverview';
import { useAuthProfile } from '../../hooks/useAuthProfile';
import { useSelectionLayer } from '../../hooks/useSelectionLayer';
import {
  NO_PADDING,
  POINT_FOCUS_ZOOM,
  boundsCenter,
  isTinyBounds,
  panelAwarePadding,
} from '../../services/map/cameraFraming';
import { EMPTY_FILTERS } from '../../hooks/useSharedFilters';
import {
  boundsOfGeometry,
  type GeoJsonGeometry,
} from '../../services/gis/geometryBounds';
import { BottomSheet } from '../../components/common/BottomSheet';
import { CompassButton } from '../../components/map/CompassButton';
import { DataOverviewFab } from '../../components/map/DataOverviewFab';
import { DataOverviewPanel } from '../../components/map/DataOverviewPanel';
import { Header, LanguageOption } from '../../components/map/Header';
import { Icon } from '../../components/common/Icon';
import { LayersFab } from '../../components/layer/LayersFab';
import { CityInfoPanel, WardInfoPanel } from '../../components/map/InfoPanels';
import { LayerMenuSheet } from '../../components/layer/LayerMenuSheet';
import { LocateButton } from '../../components/map/LocateButton';
import { MapCanvas } from '../../components/map/MapCanvas';
import { MvtFeaturePanel } from '../../components/feature/MvtFeaturePanel';
import { SearchSheet, type SearchResult } from '../search/SearchSheet';
import { COLORS, SPACING } from '../../constants/theme';

const FEATURE_SEARCH_DEBOUNCE_MS = 350;
const FEATURE_SEARCH_PER_LAYER = 3;

function formatSyncTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(
    d.getMonth() + 1,
  )}/${d.getFullYear()}`;
}

// Mốc đồng bộ mà người dùng đã đóng thông báo "đang dùng cấu hình đã lưu".
// Sống ở module scope để không hiện lại khi chuyển tab rồi quay về bản đồ;
// lần đồng bộ thất bại sau (mốc khác) vẫn hiện lại.
let dismissedStaleSyncedAt: string | null = null;

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function HueMapScreen({
  map,
  mvtLayersVisible,
  onMvtLayersVisibleChange: setMvtLayersVisible,
  focusRequest,
  onFocusHandled,
}: {
  map: ReturnType<typeof useHueMap>;
  /** Lớp chưa có trong map = đang tắt (registry tải bất đồng bộ). */
  mvtLayersVisible: Record<string, boolean>;
  onMvtLayersVisibleChange: (
    update: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void;
  focusRequest?: (MapLocateRequest & { token: number }) | null;
  onFocusHandled?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language = appLanguage(i18n.resolvedLanguage ?? i18n.language);
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [dataOverviewOpen, setDataOverviewOpen] = useState(false);
  const [search, setSearch] = useState('');

  const registry = useMapRegistry();
  const mvtLayers = registry.layers;
  const [staleDismissedAt, setStaleDismissedAt] = useState(
    dismissedStaleSyncedAt,
  );
  const dismissStaleNotice = () => {
    dismissedStaleSyncedAt = registry.syncedAt ?? null;
    setStaleDismissedAt(dismissedStaleSyncedAt);
  };
  const profile = useAuthProfile();
  const scopeLabel = profile
    ? t('scope.label', {
        scope:
          profile.wardScope.type === 'all'
            ? t('scope.all')
            : t('scope.wards', { count: profile.wardScope.wardIds.length }),
      })
    : undefined;
  const [selectedMvtFeature, setSelectedMvtFeature] = useState<{
    layer: MvtLayerConfig;
    properties: Record<string, unknown>;
    coordinates: [number, number] | null;
  } | null>(null);
  const [highlightGeometry, setHighlightGeometry] =
    useState<GeoJsonGeometry | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { showForSelection, releaseSelection, noteUserToggle } =
    useSelectionLayer(mvtLayersVisible, setMvtLayersVisible);
  const closeMvtFeature = () => {
    setSelectedMvtFeature(null);
    setHighlightGeometry(null);
    // Lớp chỉ tạm bật để xem đối tượng này -> trả về trạng thái cũ.
    releaseSelection();
  };
  /** Bật/tắt lớp từ menu lớp bản đồ (người dùng chủ động). */
  const toggleMvtLayer = (id: string, visible: boolean) => {
    noteUserToggle(id);
    setMvtLayersVisible(current => ({ ...current, [id]: visible }));
    if (!visible) closeMvtFeature();
  };

  const selectionTokenRef = useRef(0);
  const selectFeature = (
    layer: MvtLayerConfig,
    properties: Record<string, unknown>,
    coordinates: [number, number] | null,
    alreadyFull: boolean,
  ) => {
    const token = ++selectionTokenRef.current;
    map.clearSelection();
    setSelectedMvtFeature({ layer, properties, coordinates });
    setHighlightGeometry(null);

    const applyGeom = (geom: unknown, flyToPointIfNoBounds: boolean) => {
      const geometry = (geom ?? null) as GeoJsonGeometry;
      setHighlightGeometry(geometry);
      const bounds = boundsOfGeometry(geometry);
      if (bounds) {
        focusBounds(bounds);
      } else if (flyToPointIfNoBounds && coordinates) {
        focusPoint(coordinates);
      }
    };

    if (alreadyFull) {
      applyGeom(properties[layer.geometryField], true);
      return;
    }
    const id = getFeatureId(layer, properties);
    if (!id) return;
    fetchFeatureRecord(layer, id).then(full => {
      if (selectionTokenRef.current !== token || !full) return;
      setSelectedMvtFeature(current =>
        current && current.layer.id === layer.id
          ? { ...current, properties: full }
          : current,
      );
      applyGeom(full[layer.geometryField], false);
    });
  };

  const [showUserLocation, setShowUserLocation] = useState(false);

  const [bearing, setBearing] = useState(0);
  const resetBearing = () => {
    cameraRef.current?.setStop({ bearing: 0, pitch: 0, duration: 300 });
  };

  // Tìm trong các lớp registry theo searchableFields (tài liệu mục 4).
  const [featureMatches, setFeatureMatches] = useState<
    Array<{ layer: MvtLayerConfig; record: DataRecord }>
  >([]);
  const [featureSearching, setFeatureSearching] = useState(false);
  useEffect(() => {
    const query = search.trim();
    const searchLayers = mvtLayers.filter(
      layer => layer.capabilities.search && layer.searchableFields.length > 0,
    );
    if (query.length < 2 || searchLayers.length === 0) {
      setFeatureMatches([]);
      setFeatureSearching(false);
      return undefined;
    }
    let cancelled = false;
    setFeatureSearching(true);
    const timer = setTimeout(() => {
      const labels = {
        yes: t('common.yes'),
        no: t('common.no'),
        male: t('common.male'),
        female: t('common.female'),
      };
      Promise.all(
        searchLayers.map(layer =>
          fetchDataRecordsPage({
            layer,
            search: query,
            filters: EMPTY_FILTERS,
            labels,
            pageSize: FEATURE_SEARCH_PER_LAYER,
          }).then(page => page.items.map(record => ({ layer, record }))),
        ),
      )
        .then(results => {
          if (!cancelled) setFeatureMatches(results.flat());
        })
        .finally(() => {
          if (!cancelled) setFeatureSearching(false);
        });
    }, FEATURE_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, mvtLayers, t]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const query = normalizeSearchText(search);
    if (!query) return [];

    const wardResults = map.wards
      .map(ward => {
        const title =
          getLocalizedDataValue(
            ward.properties,
            ['nhanBanDo', 'nhan', 'Nhan', 'diaDanh'],
            language,
          ).value ||
          ward.label ||
          ward.name;
        const type =
          getLocalizedDataValue(
            ward.properties,
            ['danhTuChung', 'danhTuChun'],
            language,
          ).value || ward.type;
        return { ward, title, type };
      })
      .filter(({ ward, title, type }) =>
        normalizeSearchText(
          [title, ward.name, ward.label, ward.code, type].join(' '),
        ).includes(query),
      )
      .map(({ ward, title, type }) => ({
        id: ward.id,
        kind: 'ward' as const,
        title,
        layer: t('search.administrativeLayer'),
        detail: ward.code ? t('search.unitCode', { code: ward.code }) : type,
        color: '#0878bd',
      }));

    const featureResults = featureMatches.map(({ layer, record }) => ({
      id: `${layer.id}:${record.id}`,
      kind: 'feature' as const,
      title: record.title,
      layer: layer.label,
      detail: record.lines.map(line => line.value).join(' · '),
      color: layer.color,
    }));

    // Dự án đầu tư nằm trong featureResults (lớp registry
    // danh_muc_du_an_thu_hut_dau_tu), không còn nguồn riêng.
    return [...wardResults, ...featureResults];
  }, [featureMatches, language, map.wards, search, t]);

  useEffect(() => {
    if (!focusRequest) return undefined;

    const applyFocus = () => {
      const layer = mvtLayers.find(item => item.id === focusRequest.layerId);
      if (layer) {
        showForSelection(layer.id);
        selectFeature(
          layer,
          focusRequest.properties,
          focusRequest.coordinates,
          true,
        );
      }
      onFocusHandled?.();
    };

    if (mapReady) {
      applyFocus();
      return undefined;
    }
    const timer = setTimeout(applyFocus, 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, mapReady, onFocusHandled]);

  // Chiều cao thật của vùng bản đồ — panel chi tiết chiếm tối đa 58% vùng này.
  const [mapHeight, setMapHeight] = useState(0);
  const cameraPadding = (withPanel: boolean) =>
    withPanel ? panelAwarePadding(mapHeight, insets.top) : NO_PADDING;
  /**
   * Bay tới một điểm. withPanel: panel chi tiết sẽ mở ở đáy -> đặt điểm
   * giữa phần bản đồ không bị panel che (lệch lên trên).
   */
  const focusPoint = (center: [number, number], withPanel = true) => {
    cameraRef.current?.setStop({
      center,
      zoom: POINT_FOCUS_ZOOM,
      padding: cameraPadding(withPanel),
      duration: 900,
    });
  };
  const focusBounds = (
    bounds: [number, number, number, number] | null,
    withPanel = true,
  ) => {
    if (!bounds) return;
    // Điểm / vùng rất nhỏ: fitBounds sẽ phóng tới zoom tối đa -> căn giữa.
    if (isTinyBounds(bounds)) {
      focusPoint(boundsCenter(bounds), withPanel);
      return;
    }
    cameraRef.current?.fitBounds(bounds, {
      padding: cameraPadding(withPanel),
      duration: 900,
    });
  };

  const selectWardAndFocus = (ward: Ward) => {
    map.selectWard(ward);
    focusBounds(map.wardBoundsById(ward.id));
  };

  const handleSearchSelect = (result: SearchResult) => {
    setSearch(result.title);
    setSearchOpen(false);
    setMenuOpen(false);
    if (result.kind === 'ward') {
      const ward = map.wards.find(item => item.id === result.id);
      if (ward) selectWardAndFocus(ward);
      return;
    }
    if (result.kind === 'feature') {
      const match = featureMatches.find(
        ({ layer, record }) => `${layer.id}:${record.id}` === result.id,
      );
      if (!match) return;
      const { layer, record } = match;
      const geometry = record.properties[layer.geometryField] as
        | { type: string; coordinates: unknown }
        | null
        | undefined;
      if (!layer.capabilities.detail) {
        // Không có chi tiết (không có panel để đóng): bật lớp như người dùng
        // tự bật, rồi chỉ đưa bản đồ tới đối tượng.
        closeMvtFeature();
        toggleMvtLayer(layer.id, true);
        const bounds = boundsOfGeometry((geometry ?? null) as GeoJsonGeometry);
        const point = extractRepresentativePoint(geometry);
        // Không mở panel -> không cần chừa chỗ.
        if (bounds) focusBounds(bounds, false);
        else if (point) focusPoint(point, false);
        return;
      }
      showForSelection(layer.id);
      selectFeature(
        layer,
        record.properties,
        extractRepresentativePoint(geometry),
        true,
      );
    }
  };

  return (
    <View
      style={styles.root}
      onLayout={event => setMapHeight(event.nativeEvent.layout.height)}
    >
      <MapCanvas
        cameraRef={cameraRef}
        language={language}
        wardData={map.wardData}
        hiddenWardIds={map.hiddenWardIds}
        selectedWardId={map.selectedWard?.id ?? null}
        cityVisible={map.cityVisible}
        onCityPress={() => {
          closeMvtFeature();
          map.selectCity();
        }}
        onWardPress={properties => {
          closeMvtFeature();
          const ward = normalizeWard(properties);
          map.selectWard(ward);
        }}
        mvtLayersVisible={mvtLayersVisible}
        onMvtFeaturePress={(layer, properties, coordinates) => {
          // Registry tắt capabilities.detail -> không mở panel chi tiết.
          if (!layer.capabilities.detail) return;
          selectFeature(layer, properties, coordinates, false);
        }}
        highlightFeature={
          highlightGeometry && selectedMvtFeature
            ? {
                geometry: highlightGeometry,
                color: selectedMvtFeature.layer.color,
              }
            : null
        }
        onBearingChange={setBearing}
        onMapReady={() => setMapReady(true)}
        topInset={insets.top}
        showUserLocation={showUserLocation}
      />

      <Header
        language={language}
        topInset={insets.top}
        scopeLabel={scopeLabel}
        onSearchPress={() => setSearchOpen(true)}
        onLanguagePress={() => setLanguageSheetOpen(true)}
      />

      {!menuOpen ? (
        <LayersFab onPress={() => setMenuOpen(true)} top={insets.top + 68} />
      ) : null}

      {!dataOverviewOpen ? (
        <DataOverviewFab
          onPress={() => setDataOverviewOpen(true)}
          top={insets.top + 68}
        />
      ) : null}

      <LocateButton
        onLocate={coords => {
          setShowUserLocation(true);
          // Không có panel: bỏ padding lệch còn lại từ lần chọn đối tượng.
          cameraRef.current?.setStop({
            center: coords,
            zoom: 15,
            padding: NO_PADDING,
            duration: 900,
          });
        }}
        style={{
          right: SPACING.md,
          bottom: SPACING.lg,
        }}
      />

      {Math.abs(bearing) > 0.5 ? (
        <CompassButton
          bearing={bearing}
          onPress={resetBearing}
          style={[styles.compassButton, { top: insets.top + 68 + 44 + 12 }]}
        />
      ) : null}

      {map.loading ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('map.loading')}</Text>
          </View>
        </View>
      ) : null}

      {map.citySelected ? <CityInfoPanel onClose={map.clearSelection} /> : null}
      {map.selectedWard ? (
        <WardInfoPanel ward={map.selectedWard} onClose={map.clearSelection} />
      ) : null}
      {/* FeatureDetailScreen tạm thời không dùng: panel là nơi xem thông tin. */}
      {selectedMvtFeature ? (
        <MvtFeaturePanel
          layer={selectedMvtFeature.layer}
          properties={selectedMvtFeature.properties}
          onClose={closeMvtFeature}
        />
      ) : null}

      <DataOverviewPanel
        visible={dataOverviewOpen}
        onClose={() => setDataOverviewOpen(false)}
      />

      {registry.stale &&
      registry.syncedAt &&
      registry.syncedAt !== staleDismissedAt &&
      !(map.error && !map.loading) ? (
        <View style={[styles.staleBanner, { top: insets.top + 64 }]}>
          <Icon name="info" size={14} color={COLORS.warningText} />
          <Text style={styles.staleText} numberOfLines={2}>
            {t('map.registryStale', {
              time: formatSyncTime(registry.syncedAt),
            })}
          </Text>
          <Pressable
            onPress={dismissStaleNotice}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Icon name="close" size={14} color={COLORS.warningText} />
          </Pressable>
        </View>
      ) : null}

      {!map.loading && map.error ? (
        <View style={[styles.errorBanner, { top: insets.top + 64 }]}>
          <Icon name="info" size={14} color={COLORS.critical} />
          <Text style={styles.errorText} numberOfLines={2}>
            {map.error}
          </Text>
        </View>
      ) : null}

      <LayerMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        loading={map.loading}
        error={map.error}
        cityVisible={map.cityVisible}
        citySelected={map.citySelected}
        allWardsVisible={map.hiddenWardIds.size === 0}
        selectedWardId={map.selectedWard?.id ?? null}
        onToggleCity={map.toggleCity}
        onSelectCity={map.selectCity}
        onToggleAllWards={map.toggleAllWards}
        onViewAllWards={map.clearSelection}
        mvtLayersVisible={mvtLayersVisible}
        onToggleMvtLayer={toggleMvtLayer}
      />

      <SearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        query={search}
        onQueryChange={setSearch}
        results={searchResults.slice(0, 20)}
        totalCount={searchResults.length}
        searching={featureSearching}
        onSelect={handleSearchSelect}
      />

      <BottomSheet
        visible={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        maxHeight={420}
      >
        <View style={styles.langSheetHeader}>
          <Icon name="language" size={16} color={COLORS.primaryDark} />
        </View>
        {SUPPORTED_LANGUAGES.map(code => (
          <LanguageOption
            key={code}
            code={code}
            label={t(`language.${code}`)}
            active={code === language}
            onPress={() => {
              changeAppLanguage(code as SupportedLanguage);
              setLanguageSheetOpen(false);
            }}
          />
        ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  errorBanner: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f3c9c9',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  errorText: { flex: 1, fontSize: 11, color: COLORS.critical },
  staleBanner: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,248,230,0.97)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f3dfa9',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  staleText: { flex: 1, fontSize: 11, color: COLORS.warningText },
  compassButton: { position: 'absolute', right: SPACING.md },
  langSheetHeader: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
});
