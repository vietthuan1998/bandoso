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
import {
  boundsOfGeometry,
  type GeoJsonGeometry,
} from '../../map/geometryBounds';
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
  map: ReturnType<typeof useHueMap>;
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

  const [mvtLayersVisible, setMvtLayersVisible] = useState<
    Record<string, boolean>
  >(() => Object.fromEntries(MVT_LAYERS.map(layer => [layer.id, false])));
  const [selectedMvtFeature, setSelectedMvtFeature] = useState<{
    layer: MvtLayerConfig;
    properties: Record<string, unknown>;
    coordinates: [number, number];
  } | null>(null);
  const [mvtFeatureDetailOpen, setMvtFeatureDetailOpen] = useState(false);
  const [highlightGeometry, setHighlightGeometry] =
    useState<GeoJsonGeometry | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const closeMvtFeature = () => {
    setSelectedMvtFeature(null);
    setMvtFeatureDetailOpen(false);
    setHighlightGeometry(null);
  };
  const toggleMvtLayer = (id: string, visible: boolean) => {
    setMvtLayersVisible(current => ({ ...current, [id]: visible }));
    if (!visible) closeMvtFeature();
  };

  const selectionTokenRef = useRef(0);
  const selectFeature = (
    layer: MvtLayerConfig,
    properties: Record<string, unknown>,
    coordinates: [number, number],
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
      } else if (flyToPointIfNoBounds) {
        cameraRef.current?.setStop({
          center: coordinates,
          zoom: 17,
          duration: 900,
        });
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

  const [showUserLocation, setShowUserLocation] = useState(false);

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

  useEffect(() => {
    if (!focusRequest) return undefined;

    const applyFocus = () => {
      const layer = MVT_LAYERS.find(item => item.id === focusRequest.layerId);
      if (layer) {
        toggleMvtLayer(layer.id, true);
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
