import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import {
  changeAppLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../../i18n';
import { appLanguage, getLocalizedDataValue } from '../../i18n/localizedData';
import {
  normalizeProject,
  normalizeWard,
  useHueMap,
} from '../../map/useHueMap';
import type { ProjectSearchItem, Ward } from '../../map/types';
import { PROJECT_CATEGORIES } from '../../map/projectLayers';
import { MVT_LAYERS, type MvtLayerConfig } from '../../map/mvtLayers';
import {
  fetchRecordById,
  pickRecordId,
  type MapLocateRequest,
} from '../../map/dataRecords';
import { boundsOfGeometry, type GeoJsonGeometry } from '../../map/geometryBounds';
import { BottomSheet } from './BottomSheet';
import { CompassButton } from './CompassButton';
import { DataOverviewFab } from './DataOverviewFab';
import { DataOverviewPanel } from './DataOverviewPanel';
import { FeatureDetailScreen } from './FeatureDetailScreen';
import { Header, LanguageOption } from './Header';
import { Icon } from './Icon';
import { LayersFab } from './LayersFab';
import {
  CityInfoPanel,
  ProjectInfoPanel,
  ProjectLegendPanel,
  WardInfoPanel,
} from './InfoPanels';
import { LayerMenuSheet } from './LayerMenuSheet';
import { LocateButton } from './LocateButton';
import { MapCanvas } from './MapCanvas';
import { MvtFeaturePanel } from './MvtFeaturePanel';
import { SearchSheet, type SearchResult } from './SearchSheet';
import { COLORS, SPACING } from './theme';

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
  focusRequest,
  onFocusHandled,
}: {
  /**
   * Dữ liệu bản đồ (phường/xã, dự án...) — được gọi ở AppShell (component
   * cha) chứ không gọi useHueMap() ngay tại đây, để dữ liệu này SỐNG SÓT khi
   * chuyển qua tab khác rồi quay lại tab Bản đồ, và để tab Thống kê
   * (StatisticsScreen) dùng chung mà không phải tải lại từ đầu.
   */
  map: ReturnType<typeof useHueMap>;
  /**
   * Yêu cầu xử lý ngay khi màn hình này mở ra, đến từ nút "Định vị trên bản
   * đồ" của DataScreen (tab "Dữ liệu") — bật lớp MVT tương ứng (nếu đang
   * tắt), chọn đúng đối tượng đó (hiện MvtFeaturePanel như khi chạm trực
   * tiếp trên bản đồ) rồi bay camera tới toạ độ, xem AppShell.
   */
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

  // 14 lớp MVT (mục 8 tài liệu kỹ thuật) — mặc định tắt hết cho tới khi
  // người dùng tự bật từng lớp trong menu.
  const [mvtLayersVisible, setMvtLayersVisible] = useState<
    Record<string, boolean>
  >(() => Object.fromEntries(MVT_LAYERS.map(layer => [layer.id, false])));
  const [selectedMvtFeature, setSelectedMvtFeature] = useState<{
    layer: MvtLayerConfig;
    properties: Record<string, unknown>;
    /** Toạ độ [lng, lat] người dùng đã chạm để chọn đối tượng — dùng cho nút
     * "Định vị trên bản đồ" của FeatureDetailScreen. */
    coordinates: [number, number];
  } | null>(null);
  // Trang "Chi tiết đối tượng" toàn màn hình (FeatureDetailScreen), mở từ
  // link "Xem chi tiết" trong MvtFeaturePanel — tách riêng khỏi
  // selectedMvtFeature để đóng/mở không làm mất lựa chọn hiện tại.
  const [mvtFeatureDetailOpen, setMvtFeatureDetailOpen] = useState(false);
  // Hình học THẬT (geom, lấy qua fetchRecordById — xem selectFeature bên
  // dưới) của đối tượng đang chọn, dùng để tô nổi bật đúng hình dạng lên
  // MapCanvas — null khi chưa chọn gì hoặc chưa/không lấy được geom.
  const [highlightGeometry, setHighlightGeometry] =
    useState<GeoJsonGeometry | null>(null);
  const closeMvtFeature = () => {
    setSelectedMvtFeature(null);
    setMvtFeatureDetailOpen(false);
    setHighlightGeometry(null);
  };
  const toggleMvtLayer = (id: string, visible: boolean) => {
    setMvtLayersVisible(current => ({ ...current, [id]: visible }));
    if (!visible) closeMvtFeature();
  };

  // Chọn 1 layer + toạ độ + properties BAN ĐẦU (nhanh, có ngay — từ tile MVT
  // khi chạm trực tiếp, hoặc từ DataScreen khi "Định vị trên bản đồ"), rồi
  // NÂNG CẤP bất đồng bộ lên bản ghi gốc mới nhất (kèm geom) qua
  // fetchRecordById — dùng CHUNG cho cả 2 đường vào (chạm trên bản đồ VÀ từ
  // tab "Dữ liệu"), để FeatureDetailScreen/MvtFeaturePanel luôn hiển thị
  // cùng 1 dữ liệu bất kể mở từ đâu (xem giải thích trong hội thoại — trước
  // đây properties từ tile MVT và từ Items API lệch nhau). Đồng thời, có
  // geom thật thì tô nổi bật đúng hình dạng đối tượng + bay camera khung vừa
  // đúng nó (fitBounds) thay vì chỉ bay tới 1 điểm đại diện.
  //
  // QUAN TRỌNG: hàm này là NƠI DUY NHẤT ra lệnh camera cho 1 lần chọn đối
  // tượng — ĐÚNG 1 lệnh camera mỗi lần gọi, không bao giờ 2. Từng có lỗi
  // thật: nơi gọi (focusRequest bên dưới) tự bắn thêm 1 setStop() TRƯỚC khi
  // gọi hàm này — 2 lệnh camera liên tiếp trong cùng 1 tick khiến cameraRef
  // (native) bỏ qua lệnh sau, biểu hiện là "từ tab Dữ liệu bấm định vị nhưng
  // camera không nhúc nhích", trong khi chạm trực tiếp trên bản đồ (chỉ có 1
  // lệnh fitBounds duy nhất) vẫn hoạt động bình thường.
  const selectionTokenRef = useRef(0);
  const selectFeature = (
    layer: MvtLayerConfig,
    properties: Record<string, unknown>,
    coordinates: [number, number],
    /** properties ĐÃ LÀ bản ghi gốc rồi (từ DataScreen, qua Items API) —
     * không cần fetchRecordById lại, dùng geom sẵn có trong properties luôn. */
    alreadyFull: boolean,
  ) => {
    const token = ++selectionTokenRef.current;
    map.clearSelection();
    setSelectedMvtFeature({ layer, properties, coordinates });
    setHighlightGeometry(null);

    /** flyToPointIfNoBounds: DataScreen luôn là 1 hành động điều hướng chủ
     * động ("Định vị trên bản đồ") — camera BẮT BUỘC phải di chuyển tới đâu
     * đó dù bản ghi không có geom hợp lệ. Chạm trực tiếp trên bản đồ thì
     * không cần ép — người dùng đã thấy đối tượng ngay tại đó rồi. */
    const applyGeom = (geom: unknown, flyToPointIfNoBounds: boolean) => {
      const geometry = (geom ?? null) as GeoJsonGeometry;
      setHighlightGeometry(geometry);
      const bounds = boundsOfGeometry(geometry);
      if (bounds) {
        focusBounds(bounds);
      } else if (flyToPointIfNoBounds) {
        cameraRef.current?.setStop({ center: coordinates, zoom: 17, duration: 900 });
      }
    };

    if (alreadyFull) {
      applyGeom(properties.geom, true);
      return;
    }
    const id = pickRecordId(properties);
    if (!id) return;
    fetchRecordById(layer, id).then(full => {
      if (selectionTokenRef.current !== token || !full) return;
      setSelectedMvtFeature(current =>
        current && current.layer.id === layer.id
          ? { ...current, properties: full }
          : current,
      );
      applyGeom(full.geom, false);
    });
  };

  // Chỉ bật chấm "vị trí của tôi" (UserLocation) SAU LẦN ĐẦU người dùng nhấn
  // LocateButton và cấp quyền thành công — không tự bật khi vào màn hình, để
  // không tự ý xin quyền/theo dõi vị trí lúc chưa ai yêu cầu.
  const [showUserLocation, setShowUserLocation] = useState(false);

  // Hướng xem hiện tại của bản đồ (độ) — hiện la bàn khi khác 0, chạm vào để
  // đưa bản đồ về hướng Bắc mặc định.
  const [bearing, setBearing] = useState(0);
  const resetBearing = () => {
    cameraRef.current?.setStop({ bearing: 0, pitch: 0, duration: 300 });
  };

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

    const projectResults = map.projects
      .map(project => {
        const name =
          getLocalizedDataValue(
            project.properties,
            ['tenDuAn', 'name'],
            language,
          ).value || project.name;
        const location =
          getLocalizedDataValue(project.properties, ['diaDiem'], language)
            .value || project.location;
        const investor =
          getLocalizedDataValue(
            project.properties,
            ['nhaDauTu', 'chuDauTu'],
            language,
          ).value || project.investor;
        const category = t(`projectCategories.${project.categoryId}`);
        return { project, name, location, investor, category };
      })
      .filter(({ project, name, location, investor, category }) =>
        normalizeSearchText(
          [
            name,
            location,
            investor,
            category,
            project.name,
            project.location,
          ].join(' '),
        ).includes(query),
      )
      .map(({ project, name, location, investor, category }) => ({
        id: `${project.categoryId}:${project.id}`,
        kind: 'project' as const,
        title: name,
        layer: t('search.projectLayer', { category }),
        detail: location || investor,
        color: project.color,
      }));

    return [...wardResults, ...projectResults];
  }, [language, map.projects, map.wards, search, t]);

  // Xử lý focusRequest đến từ DataScreen (nút "Định vị trên bản đồ") — bật
  // đúng lớp MVT của bản ghi (nếu đang tắt), chọn đối tượng đó (hiện
  // MvtFeaturePanel giống hệt như chạm trực tiếp trên bản đồ) rồi bay camera
  // tới toạ độ. CHỈ để selectFeature(..., true) ra lệnh camera — KHÔNG tự
  // gọi thêm setStop() ở đây (xem ghi chú "QUAN TRỌNG" tại khai báo
  // selectFeature: 2 lệnh camera liên tiếp trong cùng 1 tick từng khiến
  // native cameraRef bỏ qua lệnh thứ 2, camera đứng yên dù đã bật lớp/chọn
  // đúng đối tượng).
  //
  // THỬ LẠI NHIỀU LẦN thay vì đợi 1 mốc thời gian cố định: màn hình này vừa
  // được mount lại (đổi tab từ "Dữ liệu" sang "Bản đồ", cây MapCanvas khá
  // nặng — 14 nguồn vector MVT + phường/xã + dự án), cameraRef có thể CHƯA
  // gắn xong sau 1 khoảng chờ cố định trên máy chậm — gọi setStop() lúc đó
  // là gọi vào ref rỗng, không báo lỗi nhưng camera không bay tới đâu cả
  // (đúng triệu chứng "nhấn định vị nhưng không tới đúng toạ độ"). Poll tối
  // đa ~2s (20 lần / 100ms), đủ dư so với thời gian mount thực tế.
  useEffect(() => {
    if (!focusRequest) return undefined;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const applyFocus = () => {
      const layer = MVT_LAYERS.find(item => item.id === focusRequest.layerId);
      if (layer) {
        toggleMvtLayer(layer.id, true);
        selectFeature(layer, focusRequest.properties, focusRequest.coordinates, true);
      }
    };

    const tick = () => {
      if (cancelled) return;
      attempts += 1;
      if (cameraRef.current) {
        applyFocus();
        onFocusHandled?.();
        return;
      }
      if (attempts >= 20) {
        // Bỏ cuộc phần camera sau ~2s không thấy sẵn sàng, nhưng vẫn bật lớp
        // + chọn đối tượng (không phụ thuộc cameraRef) thay vì im lặng bỏ cả
        // yêu cầu — người dùng còn xem được panel, tự cuộn tới nơi được.
        applyFocus();
        onFocusHandled?.();
        return;
      }
      timer = setTimeout(tick, 100);
    };
    timer = setTimeout(tick, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggleMvtLayer/selectFeature đều ổn định theo từng lần render (định nghĩa lại mỗi render nhưng hành vi không đổi), thêm vào deps chỉ khiến effect chạy lại thừa mà không đổi kết quả.
  }, [focusRequest, onFocusHandled]);

  const focusBounds = (bounds: [number, number, number, number] | null) => {
    if (!bounds) return;
    cameraRef.current?.fitBounds(bounds, {
      padding: {
        top: insets.top + 90,
        bottom: insets.bottom + 260,
        left: 48,
        right: 48,
      },
      duration: 900,
    });
  };

  const selectWardAndFocus = (ward: Ward) => {
    map.selectWard(ward);
    focusBounds(map.wardBoundsById(ward.id));
  };

  const selectProjectAndFocus = (project: ProjectSearchItem) => {
    map.selectProject(project);
    focusBounds(project.bounds);
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
    const separator = result.id.indexOf(':');
    const categoryId = result.id.slice(0, separator);
    const projectId = result.id.slice(separator + 1);
    const project = map.projects.find(
      item => item.categoryId === categoryId && item.id === projectId,
    );
    if (project) selectProjectAndFocus(project);
  };

  return (
    <View style={styles.root}>
      <MapCanvas
        cameraRef={cameraRef}
        language={language}
        wardData={map.wardData}
        hiddenWardIds={map.hiddenWardIds}
        selectedWardId={map.selectedWard?.id ?? null}
        cityVisible={map.cityVisible}
        projectLayerVisible={map.projectLayerVisible}
        projectCategoryVisibility={map.projectCategoryVisibility}
        onCityPress={() => {
          closeMvtFeature();
          map.selectCity();
        }}
        onWardPress={properties => {
          closeMvtFeature();
          const ward = normalizeWard(properties);
          map.selectWard(ward);
        }}
        onProjectPress={(categoryId, properties) => {
          const category = PROJECT_CATEGORIES.find(
            item => item.id === categoryId,
          );
          if (!category) return;
          closeMvtFeature();
          map.selectProject(normalizeProject(category, properties));
        }}
        mvtLayersVisible={mvtLayersVisible}
        onMvtFeaturePress={(layer, properties, coordinates) => {
          // properties ở đây LẤY TỪ TILE MVT (chưa chắc đủ/mới nhất, xem ghi
          // chú tại selectFeature) — false = cần fetchRecordById nâng cấp.
          selectFeature(layer, properties, coordinates, false);
        }}
        highlightFeature={
          highlightGeometry && selectedMvtFeature
            ? { geometry: highlightGeometry, color: selectedMvtFeature.layer.color }
            : null
        }
        onBearingChange={setBearing}
        topInset={insets.top}
        showUserLocation={showUserLocation}
      />

      <Header
        language={language}
        topInset={insets.top}
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
          cameraRef.current?.setStop({
            center: coords,
            zoom: 15,
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
          // Xếp dưới DataOverviewFab (top: insets.top + 68, cao 44) + đệm 12,
          // tránh chồng lên nhau khi cả hai cùng hiển thị.
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
      {map.projectLayerVisible &&
      !map.selectedProject &&
      !map.selectedWard &&
      !map.citySelected &&
      !selectedMvtFeature ? (
        <ProjectLegendPanel
          categoryVisibility={map.projectCategoryVisibility}
          onToggleCategory={map.toggleProjectCategory}
          onClose={() => map.toggleProjectLayer(false)}
        />
      ) : null}
      {map.selectedWard ? (
        <WardInfoPanel ward={map.selectedWard} onClose={map.clearSelection} />
      ) : null}
      {map.selectedProject ? (
        <ProjectInfoPanel
          project={map.selectedProject}
          onClose={map.clearSelection}
        />
      ) : null}
      {selectedMvtFeature && !mvtFeatureDetailOpen ? (
        <MvtFeaturePanel
          layer={selectedMvtFeature.layer}
          properties={selectedMvtFeature.properties}
          onClose={closeMvtFeature}
          onViewDetail={() => setMvtFeatureDetailOpen(true)}
        />
      ) : null}

      <DataOverviewPanel
        visible={dataOverviewOpen}
        onClose={() => setDataOverviewOpen(false)}
      />

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
        projectLayerVisible={map.projectLayerVisible}
        onToggleCity={map.toggleCity}
        onSelectCity={map.selectCity}
        onToggleAllWards={map.toggleAllWards}
        onViewAllWards={map.clearSelection}
        onToggleProjectLayer={map.toggleProjectLayer}
        onActivateProjectLayer={map.activateProjectLayer}
        mvtLayersVisible={mvtLayersVisible}
        onToggleMvtLayer={toggleMvtLayer}
      />

      <SearchSheet
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        query={search}
        onQueryChange={setSearch}
        results={searchResults.slice(0, 12)}
        totalCount={searchResults.length}
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

      {/* Trang "Chi tiết đối tượng" toàn màn hình — đặt CUỐI CÙNG trong cây
          JSX để luôn vẽ đè lên Header/FAB/panel còn lại (RN vẽ theo thứ tự
          khai báo, phần tử sau nằm trên phần tử trước). */}
      {selectedMvtFeature && mvtFeatureDetailOpen ? (
        <FeatureDetailScreen
          layer={selectedMvtFeature.layer}
          properties={selectedMvtFeature.properties}
          coordinates={selectedMvtFeature.coordinates}
          onBack={() => setMvtFeatureDetailOpen(false)}
          onLocate={coordinates => {
            setMvtFeatureDetailOpen(false);
            cameraRef.current?.setStop({
              center: coordinates,
              zoom: 17,
              duration: 900,
            });
          }}
        />
      ) : null}
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
  compassButton: { position: 'absolute', right: SPACING.md },
  langSheetHeader: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
});
