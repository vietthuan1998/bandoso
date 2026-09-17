import { useEffect, useMemo, type Ref } from 'react';
import {
  Camera,
  type CameraRef,
  type FilterSpecification,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  type PressEventWithFeatures,
  TransformRequestManager,
  UserLocation,
  VectorSource,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import type { NativeSyntheticEvent } from 'react-native';
import { StyleSheet } from 'react-native';
import {
  CITY_BORDER_LAYER,
  CITY_FILL_LAYER,
  CITY_GEOJSON_URL,
  CITY_SOURCE_ID,
  STYLE_URL,
  WARD_BORDER_LAYER,
  WARD_FILL_LAYER,
  WARD_HIGHLIGHT_LAYER,
  WARD_LABEL_LAYER,
  WARD_SOURCE_ID,
} from '../../map/useHueMap';
import { TILE_AUTH_RULES } from '../../config/mapTileAuth';
import {
  PROJECT_CATEGORIES,
  projectBorderLayerId,
  projectFillLayerId,
  projectSourceId,
} from '../../map/projectLayers';
import type {
  ProjectCategoryId,
  ProjectProperties,
  WardFeatureCollection,
  WardProperties,
} from '../../map/types';
import {
  MVT_LAYERS,
  mvtCircleLayerId,
  mvtFillLayerId,
  mvtLineLayerId,
  mvtOutlineLayerId,
  mvtSourceId,
  mvtTileUrl,
  type MvtLayerConfig,
} from '../../map/mvtLayers';
import type { GeoJsonGeometry } from '../../map/geometryBounds';
import type { SupportedLanguage } from '../../i18n';

const INITIAL_CENTER: [number, number] = [107.5991, 16.4637];

const PRECISE_HITBOX = { top: 1, right: 1, bottom: 1, left: 1 };

const CITY_CEILING_LAYER = 'city-ceiling';
const WARD_CEILING_LAYER = 'ward-ceiling';
const POINTS_CEILING_LAYER = 'points-ceiling';
const POINTS_CEILING_SOURCE_ID = 'points-ceiling-source';

const FEATURE_HIGHLIGHT_SOURCE_ID = 'feature-highlight-source';
const FEATURE_HIGHLIGHT_FILL_LAYER = 'feature-highlight-fill';
const FEATURE_HIGHLIGHT_LINE_LAYER = 'feature-highlight-line';
const FEATURE_HIGHLIGHT_CIRCLE_LAYER = 'feature-highlight-circle';
const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

let authHeaderRegistered = false;
export function ensureTileAuthHeader() {
  if (authHeaderRegistered) return;
  authHeaderRegistered = true;
  TILE_AUTH_RULES.forEach(rule => {
    TransformRequestManager.addHeader({
      id: rule.id,
      match: rule.hostPattern,
      name: rule.headerName,
      value: rule.headerValue,
    });
  });
}

export function MapCanvas({
  cameraRef,
  language,
  wardData,
  hiddenWardIds,
  selectedWardId,
  cityVisible,
  projectLayerVisible,
  projectCategoryVisibility,
  onWardPress,
  onCityPress,
  onProjectPress,
  mvtLayersVisible,
  onMvtFeaturePress,
  highlightFeature,
  onBearingChange,
  onMapReady,
  topInset,
  showUserLocation,
}: {
  cameraRef: Ref<CameraRef>;
  language: SupportedLanguage;
  wardData: WardFeatureCollection | null;
  hiddenWardIds: ReadonlySet<string>;
  selectedWardId: string | null;
  cityVisible: boolean;
  projectLayerVisible: boolean;
  projectCategoryVisibility: Record<ProjectCategoryId, boolean>;
  onWardPress: (properties: WardProperties) => void;
  onCityPress: () => void;
  onProjectPress: (
    categoryId: ProjectCategoryId,
    properties: ProjectProperties,
  ) => void;
  mvtLayersVisible: Record<string, boolean>;
  onMvtFeaturePress: (
    layer: MvtLayerConfig,
    properties: Record<string, unknown>,
    coordinates: [number, number],
  ) => void;
  highlightFeature: { geometry: GeoJsonGeometry; color: string } | null;
  /** Báo lên component cha góc xoay (bearing, độ) hiện tại của bản đồ. */
  onBearingChange: (bearing: number) => void;
  onMapReady?: () => void;
  topInset: number;
  showUserLocation: boolean;
}) {
  useEffect(() => {
    ensureTileAuthHeader();
  }, []);

  const wardFilter = useMemo<FilterSpecification | undefined>(() => {
    const ids = [...hiddenWardIds];
    return ids.length
      ? ([
          '!',
          ['in', ['get', 'publicWardId'], ['literal', ids]],
        ] as FilterSpecification)
      : undefined;
  }, [hiddenWardIds]);

  const highlightFilter = useMemo<FilterSpecification | undefined>(
    () =>
      selectedWardId
        ? ([
            '==',
            ['get', 'publicWardId'],
            selectedWardId,
          ] as FilterSpecification)
        : undefined,
    [selectedWardId],
  );

  const highlightGeoJson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: highlightFeature?.geometry
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: highlightFeature.geometry as GeoJSON.Geometry,
            },
          ]
        : [],
    }),
    [highlightFeature],
  );

  const labelTextField = useMemo(
    () => [
      'coalesce',
      ['get', `nhanBanDo_${language}`],
      ['get', `diaDanh_${language}`],
      ['get', 'nhanBanDo'],
      ['get', 'diaDanh'],
      ['get', 'nhan'],
      '',
    ],
    [language],
  );

  const highlightVisible =
    Boolean(selectedWardId) && !hiddenWardIds.has(selectedWardId ?? '');

  return (
    <MapLibreMap
      style={StyleSheet.absoluteFill}
      mapStyle={STYLE_URL}
      logo={false}
      scaleBar
      scaleBarPosition={{ top: topInset + 70, left: 16 }}
      onRegionIsChanging={(event: NativeSyntheticEvent<ViewStateChangeEvent>) =>
        onBearingChange(event.nativeEvent.bearing)
      }
      onRegionDidChange={(event: NativeSyntheticEvent<ViewStateChangeEvent>) =>
        onBearingChange(event.nativeEvent.bearing)
      }
      onDidFinishLoadingMap={onMapReady}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: INITIAL_CENTER, zoom: 10 }}
        minZoom={1}
        maxZoom={20}
      />

      {showUserLocation ? <UserLocation animated accuracy /> : null}

      <GeoJSONSource
        id={POINTS_CEILING_SOURCE_ID}
        data={EMPTY_FEATURE_COLLECTION}
      >
        <Layer
          type="line"
          id={CITY_CEILING_LAYER}
          source={POINTS_CEILING_SOURCE_ID}
          layout={{ visibility: 'none' }}
        />
        <Layer
          type="line"
          id={WARD_CEILING_LAYER}
          source={POINTS_CEILING_SOURCE_ID}
          afterId={CITY_CEILING_LAYER}
          layout={{ visibility: 'none' }}
        />
        <Layer
          type="line"
          id={POINTS_CEILING_LAYER}
          source={POINTS_CEILING_SOURCE_ID}
          afterId={WARD_CEILING_LAYER}
          layout={{ visibility: 'none' }}
        />
      </GeoJSONSource>

      <GeoJSONSource
        id={CITY_SOURCE_ID}
        data={CITY_GEOJSON_URL}
        hitbox={PRECISE_HITBOX}
        onPress={() => {
          if (!cityVisible) return;
          onCityPress();
        }}
      >
        <Layer
          type="fill"
          id={CITY_FILL_LAYER}
          source={CITY_SOURCE_ID}
          beforeId={CITY_CEILING_LAYER}
          paint={{ 'fill-color': '#0878bd', 'fill-opacity': 0.08 }}
          layout={{ visibility: cityVisible ? 'visible' : 'none' }}
        />
        <Layer
          type="line"
          id={CITY_BORDER_LAYER}
          source={CITY_SOURCE_ID}
          beforeId={CITY_CEILING_LAYER}
          paint={{ 'line-color': '#075a9b', 'line-width': 2.5 }}
          layout={{ visibility: cityVisible ? 'visible' : 'none' }}
        />
      </GeoJSONSource>

      {wardData ? (
        <GeoJSONSource
          id={WARD_SOURCE_ID}
          data={wardData}
          hitbox={PRECISE_HITBOX}
          onPress={(event: NativeSyntheticEvent<PressEventWithFeatures>) => {
            const properties = event.nativeEvent.features[0]?.properties as
              | WardProperties
              | undefined;
            if (properties) onWardPress(properties);
          }}
        >
          <Layer
            type="fill"
            id={WARD_FILL_LAYER}
            source={WARD_SOURCE_ID}
            beforeId={WARD_CEILING_LAYER}
            filter={wardFilter}
            paint={{
              'fill-color': ['coalesce', ['get', 'publicFillColor'], '#1e6aa8'],
              'fill-opacity': 0.85,
            }}
          />
          <Layer
            type="line"
            id={WARD_BORDER_LAYER}
            source={WARD_SOURCE_ID}
            beforeId={WARD_CEILING_LAYER}
            filter={wardFilter}
            paint={{ 'line-color': '#68778a', 'line-width': 1.25 }}
          />
          <Layer
            type="line"
            id={WARD_HIGHLIGHT_LAYER}
            source={WARD_SOURCE_ID}
            beforeId={WARD_CEILING_LAYER}
            filter={highlightFilter}
            paint={{ 'line-color': '#d71920', 'line-width': 4 }}
            layout={{ visibility: highlightVisible ? 'visible' : 'none' }}
          />
          <Layer
            type="symbol"
            id={WARD_LABEL_LAYER}
            source={WARD_SOURCE_ID}
            beforeId={WARD_CEILING_LAYER}
            filter={wardFilter}
            layout={{
              'text-field': labelTextField as unknown as string,
              'text-size': 11,
              'text-anchor': 'center',
              'text-max-width': 8,
            }}
            paint={{
              'text-color': '#17263c',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            }}
          />
        </GeoJSONSource>
      ) : null}

      {PROJECT_CATEGORIES.map(category => {
        const visible =
          projectLayerVisible && projectCategoryVisibility[category.id];
        return (
          <GeoJSONSource
            key={category.id}
            id={projectSourceId(category.id)}
            data={category.sourceUrl}
            hitbox={PRECISE_HITBOX}
            onPress={(event: NativeSyntheticEvent<PressEventWithFeatures>) => {
              if (!visible) return;
              const properties = event.nativeEvent.features[0]?.properties as
                | ProjectProperties
                | undefined;
              if (properties) onProjectPress(category.id, properties);
            }}
          >
            <Layer
              type="fill"
              id={projectFillLayerId(category.id)}
              source={projectSourceId(category.id)}
              beforeId={POINTS_CEILING_LAYER}
              layout={{ visibility: visible ? 'visible' : 'none' }}
              paint={{ 'fill-color': category.color, 'fill-opacity': 0.32 }}
            />
            <Layer
              type="line"
              id={projectBorderLayerId(category.id)}
              source={projectSourceId(category.id)}
              beforeId={POINTS_CEILING_LAYER}
              layout={{ visibility: visible ? 'visible' : 'none' }}
              paint={{ 'line-color': category.color, 'line-width': 2 }}
            />
          </GeoJSONSource>
        );
      })}

      {MVT_LAYERS.map(mvtLayer => {
        const visible = mvtLayersVisible[mvtLayer.id] ?? false;
        const sourceId = mvtSourceId(mvtLayer.id);
        return (
          <VectorSource
            key={mvtLayer.id}
            id={sourceId}
            tiles={[mvtTileUrl(mvtLayer.collection)]}
            minzoom={mvtLayer.minzoom}
            maxzoom={mvtLayer.maxzoom}
            hitbox={PRECISE_HITBOX}
            onPress={(event: NativeSyntheticEvent<PressEventWithFeatures>) => {
              if (!visible) return;
              const properties = event.nativeEvent.features[0]?.properties as
                | Record<string, unknown>
                | undefined;
              if (properties) {
                onMvtFeaturePress(
                  mvtLayer,
                  properties,
                  event.nativeEvent.lngLat,
                );
              }
            }}
          >
            {mvtLayer.geometryTypes.includes('polygon') && (
              <Layer
                type="fill"
                id={mvtFillLayerId(mvtLayer.id)}
                source={sourceId}
                source-layer={mvtLayer.collection}
                beforeId={POINTS_CEILING_LAYER}
                filter={
                  ['==', ['geometry-type'], 'Polygon'] as FilterSpecification
                }
                layout={{ visibility: visible ? 'visible' : 'none' }}
                paint={{
                  'fill-color': mvtLayer.color,
                  'fill-opacity': mvtLayer.dashed ? 0.18 : 0.35,
                }}
              />
            )}
            {mvtLayer.geometryTypes.includes('polygon') && (
              <Layer
                type="line"
                id={mvtOutlineLayerId(mvtLayer.id)}
                source={sourceId}
                source-layer={mvtLayer.collection}
                beforeId={POINTS_CEILING_LAYER}
                filter={
                  ['==', ['geometry-type'], 'Polygon'] as FilterSpecification
                }
                layout={{ visibility: visible ? 'visible' : 'none' }}
                paint={{
                  'line-color': mvtLayer.color,
                  'line-width': 1.5,
                  ...(mvtLayer.dashed ? { 'line-dasharray': [3, 2] } : null),
                }}
              />
            )}
            {mvtLayer.geometryTypes.includes('linestring') && (
              <Layer
                type="line"
                id={mvtLineLayerId(mvtLayer.id)}
                source={sourceId}
                source-layer={mvtLayer.collection}
                beforeId={POINTS_CEILING_LAYER}
                filter={
                  ['==', ['geometry-type'], 'LineString'] as FilterSpecification
                }
                layout={{ visibility: visible ? 'visible' : 'none' }}
                paint={{
                  'line-color': mvtLayer.color,
                  'line-width': 2,
                  ...(mvtLayer.dashed ? { 'line-dasharray': [3, 2] } : null),
                }}
              />
            )}
            {mvtLayer.geometryTypes.includes('point') && (
              <Layer
                type="circle"
                id={mvtCircleLayerId(mvtLayer.id)}
                source={sourceId}
                source-layer={mvtLayer.collection}
                afterId={POINTS_CEILING_LAYER}
                filter={
                  ['==', ['geometry-type'], 'Point'] as FilterSpecification
                }
                layout={{ visibility: visible ? 'visible' : 'none' }}
                paint={{
                  'circle-radius': 6,
                  'circle-color': mvtLayer.color,
                  'circle-opacity': mvtLayer.dashed ? 0.55 : 1,
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 2,
                }}
              />
            )}
          </VectorSource>
        );
      })}

      <GeoJSONSource id={FEATURE_HIGHLIGHT_SOURCE_ID} data={highlightGeoJson}>
        <Layer
          type="fill"
          id={FEATURE_HIGHLIGHT_FILL_LAYER}
          source={FEATURE_HIGHLIGHT_SOURCE_ID}
          afterId={POINTS_CEILING_LAYER}
          filter={['==', ['geometry-type'], 'Polygon'] as FilterSpecification}
          paint={{
            'fill-color': highlightFeature?.color ?? '#d71920',
            'fill-opacity': 0.28,
          }}
        />
        <Layer
          type="line"
          id={FEATURE_HIGHLIGHT_LINE_LAYER}
          source={FEATURE_HIGHLIGHT_SOURCE_ID}
          afterId={POINTS_CEILING_LAYER}
          paint={{
            'line-color': highlightFeature?.color ?? '#d71920',
            'line-width': 3.5,
          }}
        />
        <Layer
          type="circle"
          id={FEATURE_HIGHLIGHT_CIRCLE_LAYER}
          source={FEATURE_HIGHLIGHT_SOURCE_ID}
          afterId={POINTS_CEILING_LAYER}
          filter={['==', ['geometry-type'], 'Point'] as FilterSpecification}
          paint={{
            'circle-radius': 9,
            'circle-color': highlightFeature?.color ?? '#d71920',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          }}
        />
      </GeoJSONSource>
    </MapLibreMap>
  );
}
