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
import type { SupportedLanguage } from '../../i18n';

const INITIAL_CENTER: [number, number] = [107.5991, 16.4637];

const PRECISE_HITBOX = { top: 1, right: 1, bottom: 1, left: 1 };

/**
 * Ba layer "trần" vô hình, dùng làm mốc beforeId/afterId CỐ ĐỊNH để ép thứ
 * tự vẽ VÀ thứ tự ưu tiên khi chạm TOÀN CỤC giữa mọi nguồn độc lập trên bản
 * đồ: thành phố < phường/xã < dự án/MVT (vùng con, cụ thể hơn phường/xã) <
 * điểm (circle). Xếp theo thứ tự tăng dần: CITY_CEILING_LAYER (thấp nhất) →
 * WARD_CEILING_LAYER → POINTS_CEILING_LAYER (cao nhất, mọi layer dạng điểm
 * neo afterId vào đây).
 *
 * Đây không chỉ là thứ tự vẽ — theo cách @maplibre/maplibre-react-native cài
 * đặt xử lý chạm (MLRNMapView.getPressableSourceWithHighestZIndex trên
 * Android, getTouchableSourceWithHighestZIndex trên iOS), khi một điểm chạm
 * trúng nhiều nguồn cùng lúc, nguồn có layer nằm CAO NHẤT trong style sẽ
 * thắng và nhận sự kiện onPress — không có logic ưu tiên nào khác. Vì vậy
 * xếp đúng layer nào ở trên layer nào ở đây quyết định luôn thứ tự ưu tiên
 * khi chạm, tương đương cơ chế queryRenderedFeatures-guard mà bản web
 * (bandoso) dùng, nhưng thực hiện ở tầng z-order thay vì logic mỗi handler.
 *
 * TẠI SAO CẦN 3 MỐC RIÊNG THAY VÌ 1 MỐC DÙNG CHUNG: nếu mọi layer vùng (city,
 * ward, project, mvt) đều neo beforeId vào CÙNG MỘT mốc, thứ tự tương đối
 * giữa chúng phụ thuộc vào THỜI ĐIỂM MOUNT thực tế — layer mount sau nằm gần
 * mốc hơn. Khối phường/xã (`wardData ? ... : null`) chỉ mount sau khi dữ
 * liệu tải xong bất đồng bộ, nên có thể mount SAU các layer MVT/dự án (vốn
 * mount ngay từ lần render đầu) — khiến phường/xã nhảy lên trên, đè mất các
 * vùng con MVT/dự án cụ thể hơn nó, dù ý đồ ngược lại. Dùng 3 mốc mount TĨNH
 * (không phụ thuộc dữ liệu nào), tự chuỗi vào nhau bằng afterId ngay từ đầu,
 * đảm bảo TRẦN của mỗi tầng đã có thứ tự cố định trước khi bất kỳ layer dữ
 * liệu thật nào (city/ward/project/mvt) kịp mount — nên layer thật của mỗi
 * tầng, dù mount lúc nào, cũng chỉ so với TRẦN của tầng mình, không phụ
 * thuộc thời điểm mount của tầng khác.
 *
 * QUAN TRỌNG: cả 3 layer trần phải nằm trong một nguồn (source) RIÊNG, KHÔNG
 * có onPress (xem POINTS_CEILING_SOURCE_ID bên dưới) — tuyệt đối không gắn
 * vào bất kỳ nguồn nào có onPress. Cơ chế xử lý chạm của thư viện gom toàn
 * bộ layer con của MỘT nguồn đang bị chạm trúng lại làm "đại diện" cho
 * nguồn đó rồi mới so z-order; nếu trần (luôn nằm rất cao) bị coi là con
 * của một nguồn cụ thể, nguồn đó sẽ mượn luôn vị trí cao đó và thắng ưu
 * tiên ở MỌI nơi nó phủ tới, bất kể layer thật của nó có nằm trên tại điểm
 * chạm hay không — từng gây lỗi thành phố cướp ưu tiên của phường/xã và MVT
 * dù đã xếp z-order đúng.
 */
const CITY_CEILING_LAYER = 'city-ceiling';
const WARD_CEILING_LAYER = 'ward-ceiling';
const POINTS_CEILING_LAYER = 'points-ceiling';
const POINTS_CEILING_SOURCE_ID = 'points-ceiling-source';
const EMPTY_FEATURE_COLLECTION: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

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
  onBearingChange,
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
  ) => void;
  /** Báo lên component cha góc xoay (bearing, độ) hiện tại của bản đồ. */
  onBearingChange: (bearing: number) => void;
  /**
   * Khoảng cách an toàn từ mép trên màn hình (safe-area inset). BẮT BUỘC
   * cần để đặt lại vị trí thước tỉ lệ (scaleBar): margin mặc định của thư
   * viện (~8dp từ mép trên MapView) rơi đúng vào vùng bị Header (thanh tiêu
   * đề trắng đục render CHỒNG LÊN bản đồ, xem HueMapScreen/index.tsx) che
   * khuất — thước vẫn được vẽ nhưng nằm dưới lớp Header nên không nhìn
   * thấy. Không phải vấn đề thẩm mỹ, không đặt lại là thước không hiện ra.
   */
  topInset: number;
  /**
   * Hiện chấm "vị trí của tôi" (UserLocation) trên bản đồ — chỉ true sau khi
   * LocateButton (HueMapScreen/index.tsx) xin quyền thành công lần đầu, để
   * không tự ý theo dõi vị trí thiết bị khi chưa ai yêu cầu.
   */
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
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: INITIAL_CENTER, zoom: 10 }}
        minZoom={1}
        maxZoom={20}
      />

      {/*
        Chấm xanh đánh dấu vị trí hiện tại của thiết bị (kiểu Google Maps) —
        chỉ mount sau khi LocateButton đã xin quyền vị trí thành công
        (showUserLocation), nên không tự động theo dõi/tiêu hao pin khi chưa
        ai bấm nút định vị. `accuracy` vẽ thêm vòng tròn bán kính sai số GPS.
      */}
      {showUserLocation ? <UserLocation animated accuracy /> : null}

      {/*
        Nguồn riêng, KHÔNG có onPress, chỉ để chứa 3 layer trần vô hình xếp
        theo thứ tự cố định (xem giải thích ở khai báo hằng số phía trên).
        Đặt ngay sau Camera, mount TĨNH không phụ thuộc dữ liệu nào — để thứ
        tự CITY_CEILING < WARD_CEILING < POINTS_CEILING được xác lập trước
        khi bất kỳ layer city/ward/project/mvt thật nào kịp mount.

        Bắt buộc phải tách nguồn riêng: nếu gắn layer trần vào một nguồn có
        onPress (như CITY_SOURCE_ID ở lần sửa trước), cơ chế xử lý chạm của
        maplibre-react-native (getPressableSourceWithHighestZIndex trên
        Android, getTouchableSourceWithHighestZIndex trên iOS) sẽ coi trần
        là layer "đại diện" cho nguồn đó — vì trần luôn nằm rất cao, nguồn đó
        sẽ mượn luôn vị trí cao đó và thắng ưu tiên chạm ở MỌI nơi nó phủ
        tới, bất kể layer thật của nó có thật sự nằm trên tại điểm chạm hay
        không (đây chính là lỗi khiến thành phố "cướp" ưu tiên của phường/xã
        và thửa đất). Một nguồn không có onPress bị loại khỏi toàn bộ danh
        sách xét ưu tiên chạm (pressableSources), nên layer trần đặt ở đây
        chỉ còn tác dụng thuần z-order.
      */}
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

      {/*
        Thử nghiệm đường ống MVT (mục 8 + 10.1 đặc tả kỹ thuật): tile lấy trực
        tiếp từ dcu.huecity.vn, source-layer = tên collection Directus.
        Header Bearer cho host này đã đăng ký ở ensureTileAuthHeader().
      */}
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
              if (properties) onMvtFeaturePress(mvtLayer, properties);
            }}
          >
            {/*
              Thứ tự vẽ theo mục 10.1: polygon → outline → line → point.
              Một collection có thể trộn nhiều kiểu hình học (mục 9), nên mỗi
              layer tự lọc đúng kiểu bằng ['==', ['geometry-type'], ...] thay
              vì giả định cả source-layer chỉ có một kiểu duy nhất.
            */}
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
                  // Lớp "định hướng" (quy hoạch tương lai) vẽ nhạt hơn "hiện
                  // trạng" cùng chủ đề để phân biệt trực quan.
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
                  // Lớp "định hướng" vẽ nhạt hơn "hiện trạng", nhất quán với
                  // fill-opacity của polygon cùng chủ đề.
                  'circle-opacity': mvtLayer.dashed ? 0.55 : 1,
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
