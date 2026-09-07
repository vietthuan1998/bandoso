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
  VectorSource,
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
  MVT_PROTOTYPE_LAYERS,
  mvtCircleLayerId,
  mvtFillLayerId,
  mvtOutlineLayerId,
  mvtSourceId,
  mvtTileUrl,
  type MvtLayerConfig,
} from '../../map/mvtLayers';
import type { SupportedLanguage } from '../../i18n';

const INITIAL_CENTER: [number, number] = [107.5991, 16.4637];

const PRECISE_HITBOX = { top: 1, right: 1, bottom: 1, left: 1 };

let authHeaderRegistered = false;
function ensureTileAuthHeader() {
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
  ) => void;
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
    <MapLibreMap style={StyleSheet.absoluteFill} mapStyle={STYLE_URL}>
      <Camera
        ref={cameraRef}
        initialViewState={{ center: INITIAL_CENTER, zoom: 10 }}
        minZoom={1}
        maxZoom={20}
      />

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
          paint={{ 'fill-color': '#0878bd', 'fill-opacity': 0.08 }}
          layout={{ visibility: cityVisible ? 'visible' : 'none' }}
        />
        <Layer
          type="line"
          id={CITY_BORDER_LAYER}
          source={CITY_SOURCE_ID}
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
            filter={wardFilter}
            paint={{ 'line-color': '#68778a', 'line-width': 1.25 }}
          />
          <Layer
            type="line"
            id={WARD_HIGHLIGHT_LAYER}
            source={WARD_SOURCE_ID}
            filter={highlightFilter}
            paint={{ 'line-color': '#d71920', 'line-width': 4 }}
            layout={{ visibility: highlightVisible ? 'visible' : 'none' }}
          />
          <Layer
            type="symbol"
            id={WARD_LABEL_LAYER}
            source={WARD_SOURCE_ID}
            filter={wardFilter}
            layout={{
              // Biểu thức coalesce đa ngôn ngữ: kiểu style-spec chưa mô tả hết
              // các dạng expression runtime nên cần ép kiểu ở đây.
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
              layout={{ visibility: visible ? 'visible' : 'none' }}
              paint={{ 'fill-color': category.color, 'fill-opacity': 0.32 }}
            />
            <Layer
              type="line"
              id={projectBorderLayerId(category.id)}
              source={projectSourceId(category.id)}
              layout={{ visibility: visible ? 'visible' : 'none' }}
              paint={{ 'line-color': category.color, 'line-width': 2 }}
            />
          </GeoJSONSource>
        );
      })}

      {/*
        Thử nghiệm đường ống MVT (mục 8 + 10.1 đặc tả kỹ thuật): tile lấy trực
        tiếp từ dcu.huecity.vn, source-layer = tên collection Directus.
        Header Bearer cho host này đã đăng ký ở ensureTileAuthHeader().
      */}
      {MVT_PROTOTYPE_LAYERS.map(mvtLayer => {
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
              if (properties) onMvtFeaturePress(mvtLayer, properties);
            }}
          >
            {mvtLayer.geometry === 'polygon' ? (
              <>
                <Layer
                  type="fill"
                  id={mvtFillLayerId(mvtLayer.id)}
                  source={sourceId}
                  source-layer={mvtLayer.collection}
                  layout={{ visibility: visible ? 'visible' : 'none' }}
                  paint={{
                    'fill-color': mvtLayer.color,
                    'fill-opacity': 0.35,
                  }}
                />
                <Layer
                  type="line"
                  id={mvtOutlineLayerId(mvtLayer.id)}
                  source={sourceId}
                  source-layer={mvtLayer.collection}
                  layout={{ visibility: visible ? 'visible' : 'none' }}
                  paint={{ 'line-color': mvtLayer.color, 'line-width': 1.5 }}
                />
              </>
            ) : (
              <Layer
                type="circle"
                id={mvtCircleLayerId(mvtLayer.id)}
                source={sourceId}
                source-layer={mvtLayer.collection}
                layout={{ visibility: visible ? 'visible' : 'none' }}
                paint={{
                  'circle-radius': 6,
                  'circle-color': mvtLayer.color,
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 2,
                }}
              />
            )}
          </VectorSource>
        );
      })}
    </MapLibreMap>
  );
}
