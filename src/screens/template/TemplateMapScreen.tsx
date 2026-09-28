import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  type FilterSpecification,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  VectorSource,
} from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureTileAuthHeader } from '../../components/map/MapCanvas';
import { STYLE_URL } from '../../constants/mapSources';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { useMapRegistry } from '../../services/map/mapRegistry';
import type { MvtLayerConfig } from '../../services/map/mvtLayers';
import {
  loadWardBoundaries,
  type WardBoundaryCollection,
} from '../../services/map/wardBoundaries';
import {
  buildChoroplethClasses,
  buildWardFillColor,
  fetchWardTotals,
  NO_DATA_COLOR,
  type WardTotal,
} from '../../services/statistics/wardChoropleth';

/**
 * Màn "Template" (tạm): bản đồ dựng hoàn toàn từ API BFF để so sánh với
 * HueMapScreen hiện tại — ranh giới phường xã từ /catalog/wards/geojson, tô
 * màu theo số liệu (byWard của /statistics/summary, ghép qua mã ĐVHC), lớp
 * MVT từ registry /map/layers. Chỉ có bản đồ, không panel/tìm kiếm.
 */

// Cùng điểm nhìn ban đầu với MapCanvas để đặt hai màn cạnh nhau cho dễ so.
const INITIAL_CENTER: [number, number] = [107.5991, 16.4637];

const WARD_SOURCE_ID = 'template-wards-source';
const WARD_FILL_LAYER = 'template-wards-fill';
const WARD_LINE_LAYER = 'template-wards-line';
const WARD_LABEL_LAYER = 'template-wards-label';

const POLYGON_FILTER = [
  '==',
  ['geometry-type'],
  'Polygon',
] as FilterSpecification;
const LINE_FILTER = [
  '==',
  ['geometry-type'],
  'LineString',
] as FilterSpecification;
const POINT_FILTER = ['==', ['geometry-type'], 'Point'] as FilterSpecification;

export function TemplateMapScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const registry = useMapRegistry();
  const [wards, setWards] = useState<WardBoundaryCollection | null>(null);
  const [wardsError, setWardsError] = useState(false);
  const [wardTotals, setWardTotals] = useState<WardTotal[] | null>(null);
  const [statsError, setStatsError] = useState(false);
  const mountedRef = useRef(true);

  const loadWards = useCallback(() => {
    setWardsError(false);
    loadWardBoundaries().then(
      data => {
        if (mountedRef.current) setWards(data);
      },
      () => {
        if (mountedRef.current) setWardsError(true);
      },
    );
  }, []);

  const loadStats = useCallback(() => {
    setStatsError(false);
    fetchWardTotals().then(
      data => {
        if (mountedRef.current) setWardTotals(data);
      },
      () => {
        if (mountedRef.current) setStatsError(true);
      },
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    ensureTileAuthHeader();
    loadWards();
    loadStats();
    return () => {
      mountedRef.current = false;
    };
  }, [loadWards, loadStats]);

  const choroplethClasses = useMemo(
    () => buildChoroplethClasses((wardTotals ?? []).map(ward => ward.total)),
    [wardTotals],
  );
  const wardFillColor = useMemo(
    () => buildWardFillColor(wardTotals ?? [], choroplethClasses),
    [wardTotals, choroplethClasses],
  );

  const registryLoading =
    registry.status === 'idle' ||
    (registry.status === 'loading' && registry.layers.length === 0);

  return (
    <View style={styles.container}>
      <MapLibreMap
        style={StyleSheet.absoluteFill}
        mapStyle={STYLE_URL}
        logo={false}
      >
        <Camera
          initialViewState={{ center: INITIAL_CENTER, zoom: 10 }}
          minZoom={1}
          maxZoom={20}
        />

        {wards ? (
          <GeoJSONSource id={WARD_SOURCE_ID} data={wards}>
            <Layer
              type="fill"
              id={WARD_FILL_LAYER}
              source={WARD_SOURCE_ID}
              paint={{
                'fill-color': wardFillColor as string,
                'fill-opacity': 0.7,
              }}
            />
            <Layer
              type="line"
              id={WARD_LINE_LAYER}
              source={WARD_SOURCE_ID}
              paint={{ 'line-color': '#475569', 'line-width': 1.25 }}
            />
            <Layer
              type="symbol"
              id={WARD_LABEL_LAYER}
              source={WARD_SOURCE_ID}
              layout={{
                'text-field': ['get', 'name'] as unknown as string,
                'text-size': 11,
                'text-max-width': 8,
              }}
              paint={{
                'text-color': COLORS.text,
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
              }}
            />
          </GeoJSONSource>
        ) : null}

        {registry.layers.map(layer => (
          <RegistryLayer key={layer.id} layer={layer} />
        ))}
      </MapLibreMap>

      <View style={[styles.badge, { top: insets.top + SPACING.sm }]}>
        <Text style={styles.badgeTitle}>{t('template.badge')}</Text>
        {registryLoading || (!wards && !wardsError) ? (
          <View style={styles.badgeRow}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.badgeText}>{t('common.loading')}</Text>
          </View>
        ) : null}
        {wards || registry.layers.length ? (
          <Text style={styles.badgeText}>
            {t('template.summary', {
              wards: wards?.features.length ?? 0,
              layers: registry.layers.length,
            })}
          </Text>
        ) : null}
        {choroplethClasses.length ? (
          <View style={styles.legend}>
            <Text style={styles.badgeText}>{t('template.legendTitle')}</Text>
            <View style={styles.legendItems}>
              {choroplethClasses.map(cls => (
                <LegendItem
                  key={cls.color}
                  color={cls.color}
                  label={
                    cls.min === cls.max
                      ? formatCount(cls.max)
                      : `${formatCount(cls.min)}–${formatCount(cls.max)}`
                  }
                />
              ))}
              <LegendItem color={NO_DATA_COLOR} label={t('template.noData')} />
            </View>
          </View>
        ) : null}
        {wardsError ? (
          <ErrorRow message={t('template.wardsError')} onRetry={loadWards} />
        ) : null}
        {statsError ? (
          <ErrorRow message={t('template.statsError')} onRetry={loadStats} />
        ) : null}
        {registry.status === 'error' ? (
          <ErrorRow message={t('map.loadError')} onRetry={registry.reload} />
        ) : null}
      </View>
    </View>
  );
}

/** Một lớp registry: vẽ theo từng kiểu hình học registry khai báo. */
function RegistryLayer({ layer }: { layer: MvtLayerConfig }) {
  const sourceId = `template-mvt-${layer.id}`;
  return (
    <VectorSource
      id={sourceId}
      tiles={[layer.tileUrl]}
      minzoom={layer.minzoom}
      maxzoom={layer.maxzoom}
    >
      {layer.geometryTypes.includes('polygon') ? (
        <Layer
          type="fill"
          id={`${sourceId}-fill`}
          source={sourceId}
          source-layer={layer.sourceLayer}
          filter={POLYGON_FILTER}
          paint={{
            'fill-color': layer.color,
            'fill-opacity': 0.35,
            'fill-outline-color': layer.color,
          }}
        />
      ) : null}
      {layer.geometryTypes.includes('linestring') ? (
        <Layer
          type="line"
          id={`${sourceId}-line`}
          source={sourceId}
          source-layer={layer.sourceLayer}
          filter={LINE_FILTER}
          paint={{ 'line-color': layer.color, 'line-width': 2 }}
        />
      ) : null}
      {layer.geometryTypes.includes('point') ? (
        <Layer
          type="circle"
          id={`${sourceId}-circle`}
          source={sourceId}
          source-layer={layer.sourceLayer}
          filter={POINT_FILTER}
          paint={{
            'circle-color': layer.color,
            'circle-radius': 6,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
          }}
        />
      ) : null}
    </VectorSource>
  );
}

function formatCount(value: number): string {
  return value.toLocaleString('vi-VN');
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function ErrorRow({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.badgeRow}>
      <Text style={[styles.badgeText, styles.errorText]}>{message}</Text>
      <Pressable onPress={onRetry} hitSlop={8}>
        <Text style={styles.retry}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  badge: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    shadowColor: '#0f2c47',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  badgeTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  badgeText: { fontSize: 12, color: COLORS.textMuted },
  errorText: { flex: 1, color: COLORS.critical },
  legend: { gap: SPACING.xs },
  legendItems: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  legendLabel: { fontSize: 11, color: COLORS.textMuted },
  retry: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
});
