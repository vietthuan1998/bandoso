import type { IconName } from '../../components/common/Icon';
import { GEOJSON_URL } from '../../constants/mapSources';
import { dcuAxios, dcuHeaders, dcuItemsUrl } from '../api/dcuClient';
import {
  classifyFreshness,
  RECENT_DAYS,
  type LayerFreshness,
} from '../../utils/freshness';
import { getMapRegistry } from '../map/mapRegistry';
import type { MvtGroupConfig, MvtLayerConfig } from '../map/mvtLayers';

export function isSystemDirectusCollection(name: string): boolean {
  return name.startsWith('directus_');
}

// Lớp đưa vào thống kê: registry bật capabilities.statistics, bỏ collection hệ thống.
function statisticsLayers(layers: MvtLayerConfig[]): MvtLayerConfig[] {
  return layers.filter(
    layer =>
      layer.capabilities.statistics &&
      !isSystemDirectusCollection(layer.collection),
  );
}

const WARD_COLLECTION = 'thua_dat';
const WARD_GROUP_FIELD = 'ten_xa';

export type { LayerFreshness };

export type LayerStat = {
  layerId: string;
  collection: string;
  count: number | null;
  freshness: LayerFreshness;
  maxUpdatedAt: string | null;
};

async function fetchLayerStat(layer: MvtLayerConfig): Promise<LayerStat> {
  const dateField = layer.updatedAtField;
  try {
    const params: Record<string, string> = { 'aggregate[count]': '*' };
    if (dateField) params['aggregate[max]'] = dateField;

    const response = await dcuAxios.get<{
      data: Array<{ count?: string; max?: Record<string, string | null> }>;
    }>(dcuItemsUrl(layer.collection), { params, headers: dcuHeaders() });

    const row = response.data.data?.[0];
    const countRaw = row?.count;
    const count =
      countRaw === undefined || !Number.isFinite(Number(countRaw))
        ? null
        : Number(countRaw);

    const maxUpdatedAt = dateField ? row?.max?.[dateField] ?? null : null;
    const freshness = classifyFreshness(maxUpdatedAt);

    return {
      layerId: layer.id,
      collection: layer.collection,
      count,
      freshness,
      maxUpdatedAt,
    };
  } catch {
    return {
      layerId: layer.id,
      collection: layer.collection,
      count: null,
      freshness: 'unknown',
      maxUpdatedAt: null,
    };
  }
}

export type WardBreakdownItem = {
  ward: string;
  fullName: string;
  count: number;
};

function formatWardShortName(tenXa: string): string {
  return tenXa.replace(/^(Phường|Xã|Thị trấn)\s+/i, '');
}

function normalizeWardKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/^(phuong|xa|thi tran|tt|p|x)\s+/, '')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWardBreakdown(): Promise<{
  items: WardBreakdownItem[];
  unassignedCount: number;
}> {
  try {
    const response = await dcuAxios.get<{
      data: Array<{ [WARD_GROUP_FIELD]: string; count: string }>;
    }>(dcuItemsUrl(WARD_COLLECTION), {
      params: {
        'aggregate[count]': '*',
        'groupBy[]': WARD_GROUP_FIELD,
        'sort[]': '-count',
      },
      headers: dcuHeaders(),
    });

    const rows = response.data.data ?? [];
    let unassignedCount = 0;
    const items: WardBreakdownItem[] = [];
    for (const row of rows) {
      const name = (row[WARD_GROUP_FIELD] ?? '').trim();
      const count = Number(row.count) || 0;
      if (!name) {
        unassignedCount += count;
        continue;
      }
      items.push({ ward: formatWardShortName(name), fullName: name, count });
    }
    items.sort((a, b) => b.count - a.count);
    return { items, unassignedCount };
  } catch {
    return { items: [], unassignedCount: 0 };
  }
}

export async function fetchWardDirectory(): Promise<WardBreakdownItem[]> {
  const { items } = await fetchWardBreakdown();
  return items;
}

// ===== Phân loại theo phường/xã bằng hình học (point-in-polygon) =====

type WardShape = {
  key: string;
  ward: string;
  fullName: string;
  rings: number[][][][];
  bbox: [number, number, number, number];
};

function computeBBox(rings: number[][][][]): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of rings) {
    const ring = polygon[0];
    if (!ring) continue;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

let wardShapesPromise: Promise<WardShape[]> | null = null;

function pointInRing(pt: [number, number], ring: number[][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInMultiPolygon(
  pt: [number, number],
  rings: number[][][][],
): boolean {
  return rings.some(polygon => polygon[0] && pointInRing(pt, polygon[0]));
}

async function loadWardShapes(
  wardBreakdown: WardBreakdownItem[],
): Promise<WardShape[]> {
  if (!wardShapesPromise) {
    wardShapesPromise = dcuAxios
      .get<{
        features: Array<{
          properties: Record<string, unknown>;
          geometry: { type: string; coordinates: unknown };
        }>;
      }>(GEOJSON_URL)
      .then(res => {
        const boundaryByKey = new Map<string, number[][][][]>();
        for (const f of res.data.features ?? []) {
          const raw = String(
            f.properties?.nhanBanDo ?? f.properties?.Nhan ?? '',
          ).trim();
          if (!raw) continue;
          const geom = f.geometry;
          let rings: number[][][][] = [];
          if (geom?.type === 'MultiPolygon') {
            rings = geom.coordinates as number[][][][];
          } else if (geom?.type === 'Polygon') {
            rings = [geom.coordinates as number[][][]];
          }
          if (rings.length) boundaryByKey.set(normalizeWardKey(raw), rings);
        }
        const shapes: WardShape[] = [];
        for (const item of wardBreakdown) {
          const key = normalizeWardKey(item.fullName);
          const rings = boundaryByKey.get(key);
          if (rings) {
            shapes.push({
              key,
              ward: item.ward,
              fullName: item.fullName,
              rings,
              bbox: computeBBox(rings),
            });
          }
        }
        return shapes;
      })
      .catch(() => []);
  }
  return wardShapesPromise;
}

export function extractRepresentativePoint(
  geom: { type: string; coordinates: unknown } | null | undefined,
): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Point') {
    const c = geom.coordinates as number[];
    return Number.isFinite(c?.[0]) && Number.isFinite(c?.[1])
      ? [c[0], c[1]]
      : null;
  }
  const ring: number[][] | undefined =
    geom.type === 'Polygon'
      ? (geom.coordinates as number[][][])[0]
      : geom.type === 'MultiPolygon'
      ? (geom.coordinates as number[][][][])[0]?.[0]
      : undefined;
  if (!ring?.length) return null;
  const xs = ring.map(p => p[0]);
  const ys = ring.map(p => p[1]);
  return [
    xs.reduce((a, b) => a + b, 0) / xs.length,
    ys.reduce((a, b) => a + b, 0) / ys.length,
  ];
}

function classifyPoint(
  pt: [number, number],
  shapes: WardShape[],
): WardShape | null {
  const [x, y] = pt;
  for (const shape of shapes) {
    const [minX, minY, maxX, maxY] = shape.bbox;
    // Lọc bbox TRƯỚC (rẻ, O(1)) — loại được phần lớn phường/xã ngay lập
    // tức mà không phải quét qua hàng nghìn đỉnh ranh giới thật của chúng.
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    if (pointInMultiPolygon(pt, shape.rings)) return shape;
  }
  return null;
}

async function fetchGeometricWardCounts(
  collection: string,
  shapes: WardShape[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!shapes.length) return counts;
  try {
    const response = await dcuAxios.get<{
      data: Array<{ geom: { type: string; coordinates: unknown } | null }>;
    }>(dcuItemsUrl(collection), {
      params: { fields: 'geom', limit: -1 },
      headers: dcuHeaders(),
    });
    const rows = response.data.data ?? [];
    const CHUNK_SIZE = 200;
    for (let i = 0; i < rows.length; i++) {
      const pt = extractRepresentativePoint(rows[i].geom);
      if (pt) {
        const shape = classifyPoint(pt, shapes);
        if (shape) counts.set(shape.key, (counts.get(shape.key) ?? 0) + 1);
      }
      if (i > 0 && i % CHUNK_SIZE === 0) {
        await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
      }
    }
  } catch {}
  return counts;
}

export type TrendPoint = { date: string; label: string; count: number };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildDayWindows(
  days: number,
  anchorIso?: string | null,
): Array<{ iso: string; label: string; start: string; end: string }> {
  const result = [];
  const now = anchorIso ? new Date(`${anchorIso}T00:00:00`) : new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    result.push({
      iso: `${y}-${m}-${day}`,
      label: `${day}/${m}`,
      start: `${y}-${m}-${day}T00:00:00`,
      end: `${y}-${m}-${day}T23:59:59`,
    });
  }
  return result;
}

async function fetchDailyCount(
  collection: string,
  start: string,
  end: string,
): Promise<number> {
  try {
    const response = await dcuAxios.get<{ data: Array<{ count?: string }> }>(
      dcuItemsUrl(collection),
      {
        params: {
          'aggregate[count]': '*',
          'filter[date_updated][_between]': `${start},${end}`,
        },
        headers: dcuHeaders(),
      },
    );
    const raw = response.data.data?.[0]?.count;
    const n = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function fetchTrend(
  layerStats: LayerStat[],
  days = RECENT_DAYS,
  asOfDate: string | null = null,
): Promise<TrendPoint[]> {
  const trackedCollections = layerStats
    .filter(stat => stat.maxUpdatedAt !== null)
    .map(stat => stat.collection);
  if (!trackedCollections.length) return [];

  const windows = buildDayWindows(days, asOfDate);
  const countsPerDay = await Promise.all(
    windows.map(async day => {
      const counts = await Promise.all(
        trackedCollections.map(collection =>
          fetchDailyCount(collection, day.start, day.end),
        ),
      );
      return counts.reduce((sum, n) => sum + n, 0);
    }),
  );
  return windows.map((day, i) => ({
    date: day.iso,
    label: day.label,
    count: countsPerDay[i],
  }));
}

export async function fetchTrendForCollection(
  collection: string,
  days: number,
  asOfDate: string | null,
): Promise<TrendPoint[]> {
  const windows = buildDayWindows(days, asOfDate);
  const counts = await Promise.all(
    windows.map(day => fetchDailyCount(collection, day.start, day.end)),
  );
  return windows.map((day, i) => ({
    date: day.iso,
    label: day.label,
    count: counts[i],
  }));
}

export type StatusBucket = {
  freshness: LayerFreshness;
  recordCount: number;
  layerCount: number;
};

export type GroupStat = {
  id: string;
  label: string;
  icon: IconName;
  count: number | null;
  freshness: LayerFreshness;
  percentOfTotal: number;
};

const FRESHNESS_PRIORITY: Record<LayerFreshness, number> = {
  recent: 0,
  stale: 1,
  unknown: 2,
};

/** Nhóm thống kê = nhóm registry (menuGroup) kèm id các lớp thuộc nhóm. */
export type StatisticsGroupDef = MvtGroupConfig & { layerIds: string[] };

function buildGroupDefs(
  groups: MvtGroupConfig[],
  layers: MvtLayerConfig[],
): StatisticsGroupDef[] {
  return groups
    .map(group => ({
      ...group,
      layerIds: layers
        .filter(layer => layer.groupKey === group.key)
        .map(layer => layer.id),
    }))
    .filter(group => group.layerIds.length > 0);
}

function computeGroups(
  groupDefs: StatisticsGroupDef[],
  layerStats: LayerStat[],
  totalRecords: number,
  getCount: (stat: LayerStat) => number | null = stat => stat.count,
): GroupStat[] {
  const byId = new Map(layerStats.map(stat => [stat.layerId, stat]));
  const groups = groupDefs.map(group => {
    const stats = group.layerIds
      .map(id => byId.get(id))
      .filter((stat): stat is LayerStat => Boolean(stat));
    const counted = stats
      .map(stat => ({ stat, count: getCount(stat) }))
      .filter((x): x is { stat: LayerStat; count: number } => x.count !== null);
    const count = counted.length
      ? counted.reduce((sum, x) => sum + x.count, 0)
      : null;
    const freshness = stats.reduce<LayerFreshness>(
      (best, stat) =>
        FRESHNESS_PRIORITY[stat.freshness] < FRESHNESS_PRIORITY[best]
          ? stat.freshness
          : best,
      'unknown',
    );
    return {
      id: group.key,
      label: group.label,
      icon: group.icon,
      count,
      freshness,
      percentOfTotal:
        count !== null && totalRecords > 0 ? (count / totalRecords) * 100 : 0,
    };
  });
  return groups.sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
}

export type StatisticsOverview = {
  totalRecords: number;
  totalLayers: number;
  readableLayers: number;
  statusBuckets: StatusBucket[];
  wardBreakdown: WardBreakdownItem[];
  wardUnassignedCount: number;
  trend: TrendPoint[];
  groups: GroupStat[];
  groupDefs: StatisticsGroupDef[];
  layerStats: LayerStat[];
  layerWardCounts: Map<string, Map<string, number>>;
  wardDirectory: Map<string, { ward: string; fullName: string }>;
  generatedAt: string;
};

export async function fetchStatisticsOverview(): Promise<StatisticsOverview> {
  const registry = await getMapRegistry();
  const businessLayers = statisticsLayers(registry.layers);
  const groupDefs = buildGroupDefs(registry.groups, businessLayers);
  const [layerStats, wardResult] = await Promise.all([
    Promise.all(businessLayers.map(fetchLayerStat)),
    fetchWardBreakdown(),
  ]);
  const trend = await fetchTrend(layerStats);

  const wardShapes = await loadWardShapes(wardResult.items);
  const wardDirectory = new Map(
    wardShapes.map(s => [s.key, { ward: s.ward, fullName: s.fullName }]),
  );

  const layerWardCounts = new Map<string, Map<string, number>>();

  const thuaDatLayer = businessLayers.find(
    l => l.collection === WARD_COLLECTION,
  );
  if (thuaDatLayer) {
    const m = new Map<string, number>();
    for (const item of wardResult.items) {
      m.set(normalizeWardKey(item.fullName), item.count);
    }
    layerWardCounts.set(thuaDatLayer.id, m);
  }

  const otherLayers = businessLayers.filter(
    l => l.collection !== WARD_COLLECTION,
  );
  const otherCounts = await Promise.all(
    otherLayers.map(layer =>
      fetchGeometricWardCounts(layer.collection, wardShapes),
    ),
  );
  otherLayers.forEach((layer, i) =>
    layerWardCounts.set(layer.id, otherCounts[i]),
  );

  const combinedWardCounts = new Map<string, number>();
  for (const perLayer of layerWardCounts.values()) {
    for (const [key, count] of perLayer) {
      combinedWardCounts.set(key, (combinedWardCounts.get(key) ?? 0) + count);
    }
  }
  const wardBreakdown: WardBreakdownItem[] = wardShapes
    .map(shape => ({
      ward: shape.ward,
      fullName: shape.fullName,
      count: combinedWardCounts.get(shape.key) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const totalRecords = layerStats.reduce(
    (sum, stat) => sum + (stat.count ?? 0),
    0,
  );
  const totalClassified = wardBreakdown.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const wardUnassignedCount = Math.max(totalRecords - totalClassified, 0);

  const readableLayers = layerStats.filter(stat => stat.count !== null).length;

  const bucketTotals = new Map<LayerFreshness, StatusBucket>([
    ['recent', { freshness: 'recent', recordCount: 0, layerCount: 0 }],
    ['stale', { freshness: 'stale', recordCount: 0, layerCount: 0 }],
    ['unknown', { freshness: 'unknown', recordCount: 0, layerCount: 0 }],
  ]);
  for (const stat of layerStats) {
    const bucket = bucketTotals.get(stat.freshness);
    if (!bucket) continue;
    bucket.recordCount += stat.count ?? 0;
    bucket.layerCount += 1;
  }

  return {
    totalRecords,
    totalLayers: businessLayers.length,
    readableLayers,
    statusBuckets: [
      bucketTotals.get('recent')!,
      bucketTotals.get('stale')!,
      bucketTotals.get('unknown')!,
    ],
    wardBreakdown,
    wardUnassignedCount,
    trend,
    groups: computeGroups(groupDefs, layerStats, totalRecords),
    groupDefs,
    layerStats,
    layerWardCounts,
    wardDirectory,
    generatedAt: new Date().toISOString(),
  };
}

export function getWardTotal(
  overview: StatisticsOverview,
  wardKey: string,
): number {
  let total = 0;
  for (const perLayer of overview.layerWardCounts.values()) {
    total += perLayer.get(wardKey) ?? 0;
  }
  return total;
}

export function computeWardScopedStatus(
  overview: StatisticsOverview,
  wardKey: string,
): { total: number; buckets: StatusBucket[] } {
  const bucketTotals = new Map<LayerFreshness, StatusBucket>([
    ['recent', { freshness: 'recent', recordCount: 0, layerCount: 0 }],
    ['stale', { freshness: 'stale', recordCount: 0, layerCount: 0 }],
    ['unknown', { freshness: 'unknown', recordCount: 0, layerCount: 0 }],
  ]);
  let total = 0;
  for (const stat of overview.layerStats) {
    const count = overview.layerWardCounts.get(stat.layerId)?.get(wardKey) ?? 0;
    total += count;
    const bucket = bucketTotals.get(stat.freshness);
    if (!bucket) continue;
    bucket.recordCount += count;
    if (count > 0) bucket.layerCount += 1;
  }
  return {
    total,
    buckets: [
      bucketTotals.get('recent')!,
      bucketTotals.get('stale')!,
      bucketTotals.get('unknown')!,
    ],
  };
}

export function computeWardScopedGroups(
  overview: StatisticsOverview,
  wardKey: string,
): GroupStat[] {
  return computeGroups(
    overview.groupDefs,
    overview.layerStats,
    getWardTotal(overview, wardKey),
    stat => overview.layerWardCounts.get(stat.layerId)?.get(wardKey) ?? 0,
  );
}

export function getLayerWardBreakdown(
  overview: StatisticsOverview,
  layerId: string,
): WardBreakdownItem[] {
  const counts = overview.layerWardCounts.get(layerId);
  if (!counts) return [];
  const items: WardBreakdownItem[] = [];
  for (const [key, count] of counts) {
    const info = overview.wardDirectory.get(key);
    if (info) items.push({ ward: info.ward, fullName: info.fullName, count });
  }
  return items.sort((a, b) => b.count - a.count);
}

export async function fetchLayerAsOfCount(
  layer: MvtLayerConfig,
  asOfDate: string,
): Promise<{
  count: number | null;
  maxUpdatedAt: string | null;
  freshness: LayerFreshness;
}> {
  const dateField = layer.updatedAtField;
  try {
    const params: Record<string, string> = { 'aggregate[count]': '*' };
    if (dateField) {
      params['aggregate[max]'] = dateField;
      params[`filter[${dateField}][_lte]`] = `${asOfDate}T23:59:59`;
    }
    const response = await dcuAxios.get<{
      data: Array<{
        count?: string;
        max?: Record<string, string | null>;
      }>;
    }>(dcuItemsUrl(layer.collection), { params, headers: dcuHeaders() });
    const row = response.data.data?.[0];
    const raw = row?.count;
    const count = raw === undefined ? NaN : Number(raw);
    const maxUpdatedAt = dateField ? row?.max?.[dateField] ?? null : null;
    const freshness = classifyFreshness(maxUpdatedAt);
    return {
      count: Number.isFinite(count) ? count : null,
      maxUpdatedAt,
      freshness,
    };
  } catch {
    return { count: null, maxUpdatedAt: null, freshness: 'unknown' };
  }
}

export function layerHasDateField(layer: MvtLayerConfig): boolean {
  return layer.updatedAtField !== null;
}

export { normalizeWardKey };
