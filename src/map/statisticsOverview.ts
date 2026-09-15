import type { IconName } from '../components/HueMapScreen/Icon';
import { GEOJSON_URL } from '../data/mapSources';
import { dcuAxios, dcuHeaders, dcuItemsUrl } from './dcuClient';
import { DATA_OVERVIEW_GROUPS, type OverviewGroupConfig } from './dataOverview';
import { classifyFreshness, RECENT_DAYS, type LayerFreshness } from './freshness';
import { MVT_LAYERS, type MvtLayerConfig } from './mvtLayers';

/**
 * Nguồn dữ liệu THẬT cho tab "Thống kê" (StatisticsScreen), dựng theo mockup
 * mota/2.jpg nhưng thay các khái niệm mockup KHÔNG có dữ liệu thật hậu thuẫn
 * bằng số liệu thật tương đương gần nhất, tuyệt đối không dựng số minh hoạ
 * (cùng nguyên tắc dataOverview.ts / mục 18.1.1 đặc tả kỹ thuật).
 *
 * 1) "Theo trạng thái" — không có field trạng thái hoàn thành/lỗi dùng chung
 *    cho mọi collection. Thay bằng ĐỘ MỚI của date_updated (field thật):
 *    "Cập nhật gần đây" (≤7 ngày) / "Cần cập nhật" (cũ hơn 7 ngày) / "Không
 *    theo dõi được" (không có field, hoặc có nhưng chưa từng ghi nhận giá
 *    trị, hoặc gọi API lỗi). Chỉ thua_dat + bts có giá trị date_updated
 *    thật; nguồn còn lại field không tồn tại hoặc luôn null (đã xác nhận
 *    qua GET /fields/<collection>).
 *
 * 2) "Theo phường, xã" — TÍNH BẰNG HÌNH HỌC (point-in-polygon), không dựa
 *    vào field text nữa. Lý do: chỉ `thua_dat.ten_xa` là field text đáng
 *    tin cậy; các collection khác hoặc không có field khu vực nào, hoặc có
 *    field tên khớp nhưng giá trị vô dụng (`bts.ward` là mã số nội bộ,
 *    `rain_water_stations.phuongxa` 100% null — đã kiểm chứng thật). Vì mọi
 *    collection đều có `geom` (toạ độ thật), dùng chung 1 bộ ranh giới 40
 *    phường/xã (đúng file GeoJSON app đang vẽ trên bản đồ, xem
 *    data/mapSources.ts) để phân loại — xem loadWardShapes/classifyPoint.
 *    Đã verify bằng dữ liệu thật: khớp 100% với ten_xa trên các bản ghi có
 *    sẵn, và phân loại đúng 1830/1831 điểm BTS thật (99,9%).
 *
 * 3) "Tổng dữ liệu" — tổng số bản ghi THẬT cộng dồn qua API aggregate của
 *    toàn bộ 15 collection MVT đang cấu hình.
 *
 * LOẠI TRỪ COLLECTION HỆ THỐNG DIRECTUS: registry MVT_LAYERS hiện tại vốn
 * chỉ khai báo collection nghiệp vụ thật, nhưng vẫn lọc tường minh qua
 * isSystemDirectusCollection() làm lớp bảo vệ, phòng khi có ai thêm nhầm
 * một collection hệ thống vào registry sau này.
 */

export function isSystemDirectusCollection(name: string): boolean {
  return name.startsWith('directus_');
}

const BUSINESS_MVT_LAYERS: MvtLayerConfig[] = MVT_LAYERS.filter(
  layer => !isSystemDirectusCollection(layer.collection),
);

/**
 * Các collection có field date_updated ĐÃ XÁC NHẬN qua GET
 * /fields/<collection> — không phải mọi collection đều có field này. Chỉ
 * những id trong danh sách này mới được gọi thêm aggregate[max]=date_updated.
 */
const DATE_TRACKED_LAYER_IDS = new Set([
  'thua-dat',
  'tram-bts',
  'water-level-station',
  'iot-wind-station',
]);

/** Collection duy nhất có field địa giới hành chính dạng text đáng tin cậy. */
const WARD_COLLECTION = 'thua_dat';
const WARD_GROUP_FIELD = 'ten_xa';
const DATE_FIELD_NAME = 'date_updated';

export type { LayerFreshness };

export type LayerStat = {
  layerId: string;
  collection: string;
  /** null = gọi API lỗi (quyền truy cập/mạng), coi là "không đọc được". */
  count: number | null;
  freshness: LayerFreshness;
  maxUpdatedAt: string | null;
};

async function fetchLayerStat(layer: MvtLayerConfig): Promise<LayerStat> {
  const dateTracked = DATE_TRACKED_LAYER_IDS.has(layer.id);
  try {
    const params: Record<string, string> = { 'aggregate[count]': '*' };
    if (dateTracked) params['aggregate[max]'] = DATE_FIELD_NAME;

    const response = await dcuAxios.get<{
      data: Array<{ count?: string; max?: { date_updated?: string | null } }>;
    }>(dcuItemsUrl(layer.collection), { params, headers: dcuHeaders() });

    const row = response.data.data?.[0];
    const countRaw = row?.count;
    const count =
      countRaw === undefined || !Number.isFinite(Number(countRaw))
        ? null
        : Number(countRaw);

    const maxUpdatedAt = dateTracked ? (row?.max?.date_updated ?? null) : null;
    const freshness = classifyFreshness(maxUpdatedAt);

    return { layerId: layer.id, collection: layer.collection, count, freshness, maxUpdatedAt };
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
  /** Tên rút gọn để hiển thị, đã bỏ tiền tố "Phường"/"Xã" (vd. "Phú Hội"). */
  ward: string;
  /** Tên đầy đủ thật từ dữ liệu (vd. "Phường Phú Hội"). */
  fullName: string;
  count: number;
};

function formatWardShortName(tenXa: string): string {
  return tenXa.replace(/^(Phường|Xã|Thị trấn)\s+/i, '');
}

/**
 * Chuẩn hoá tên phường/xã thành 1 khoá để GHÉP 2 nguồn đặt tên khác nhau:
 * `thua_dat.ten_xa` ("Xã Chân Mây - Lăng Cô") và file ranh giới GeoJSON
 * ("X. Chân Mây-Lăng Cô") — bỏ dấu, hạ chữ thường, bỏ tiền tố
 * "phường/xã/p/x", gộp khoảng trắng quanh dấu gạch ngang. Đã verify khớp
 * đủ 40/40 phường/xã thật giữa 2 nguồn sau khi chuẩn hoá.
 */
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

/**
 * API RIÊNG lấy danh sách 40 phường/xã (tên + số thửa đất) — tách khỏi
 * fetchStatisticsOverview() (gọi ~30 request song song: 15 layer + 14 lớp
 * lấy geom để phân loại hình học + 1 file ranh giới) vì DataScreen (tab "Dữ
 * liệu") chỉ cần đúng danh sách tên cho ô lọc "Phường, xã", không cần toàn bộ
 * số liệu tổng hợp. Dùng lại nguyên fetchWardBreakdown() ở trên (groupBy
 * ten_xa của thua_dat — nguồn ranh giới hành chính đáng tin cậy duy nhất,
 * xem ghi chú đầu file) thay vì viết lại truy vấn.
 */
export async function fetchWardDirectory(): Promise<WardBreakdownItem[]> {
  const { items } = await fetchWardBreakdown();
  return items;
}

// ===== Phân loại theo phường/xã bằng hình học (point-in-polygon) =====

type WardShape = {
  key: string;
  ward: string;
  fullName: string;
  /** Toạ độ MultiPolygon: mảng polygon, mỗi polygon là mảng ring, mỗi ring là mảng [lng, lat]. */
  rings: number[][][][];
  /** [minX, minY, maxX, maxY] — lọc nhanh trước khi test đa giác chi tiết. */
  bbox: [number, number, number, number];
};

/**
 * Ranh giới phường/xã thật RẤT chi tiết — đã đo thật: 40 phường/xã cộng lại
 * 104.252 đỉnh, có phường tới 7.831 đỉnh (khớp coastline/núi chính xác).
 * Nếu test point-in-polygon (pointInRing, O(số đỉnh)) trực tiếp cho MỌI
 * phường/xã với MỌI điểm cần phân loại (~2.000 điểm trên 14 lớp), tổng phép
 * tính có thể lên tới hàng chục triệu — đủ để chặn đứng luồng JS một lúc
 * lâu (không chuyển được tab, không thao tác được gì) dù không phải lỗi
 * mạng. Tính sẵn bounding box O(1) cho mỗi phường/xã lúc tải ranh giới, rồi
 * luôn kiểm tra bbox (rẻ) trước — loại được phần lớn phường/xã ngay lập tức
 * mà không phải quét hết đỉnh của chúng.
 */
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

function pointInMultiPolygon(pt: [number, number], rings: number[][][][]): boolean {
  return rings.some(polygon => polygon[0] && pointInRing(pt, polygon[0]));
}

/**
 * Danh sách 40 phường/xã kèm hình dạng ranh giới thật — ghép 2 nguồn: TÊN
 * hiển thị lấy từ groupBy ten_xa của thua_dat (đã dùng thống nhất trong màn
 * hình này), HÌNH DẠNG polygon lấy từ chính file GeoJSON ranh giới app
 * đang dùng để vẽ bản đồ (GEOJSON_URL, xem data/mapSources.ts) — cùng một
 * nguồn ranh giới, không vẽ lại/suy đoán. Cache lại vì đây là dữ liệu tĩnh
 * trong 1 phiên sử dụng.
 */
async function loadWardShapes(wardBreakdown: WardBreakdownItem[]): Promise<WardShape[]> {
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
          const raw = String(f.properties?.nhanBanDo ?? f.properties?.Nhan ?? '').trim();
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

/** Point → toạ độ dùng thẳng; Polygon/MultiPolygon → trung bình toạ độ các
 * đỉnh của ring ngoài (điểm đại diện) — đủ chính xác vì thửa đất/vùng nhỏ
 * hơn nhiều so với 1 phường/xã, đã verify khớp 100% với ten_xa thật. Export
 * để DataScreen (tab "Dữ liệu") dùng lại cho nút "Định vị trên bản đồ" của 1
 * bản ghi cụ thể, không phải tính lại logic này. */
export function extractRepresentativePoint(
  geom: { type: string; coordinates: unknown } | null | undefined,
): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Point') {
    const c = geom.coordinates as number[];
    return Number.isFinite(c?.[0]) && Number.isFinite(c?.[1]) ? [c[0], c[1]] : null;
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
  return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
}

function classifyPoint(pt: [number, number], shapes: WardShape[]): WardShape | null {
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

/**
 * Phân loại TOÀN BỘ bản ghi của 1 collection theo phường/xã bằng hình học —
 * dùng cho mọi collection TRỪ thua_dat (đã có ten_xa rẻ hơn nhiều so với
 * tải hết 321.931 geom về tính). 14 collection còn lại đều nhỏ (≤1831 bản
 * ghi, đã kiểm chứng thật), tải hết geom (limit=-1) rồi phân loại — đã
 * verify với bts (1831 bản ghi, ~0,24s tải, khớp 1830/1831 điểm).
 */
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
    // Nhường luồng JS định kỳ (setTimeout 0) mỗi CHUNK_SIZE bản ghi — dù đã
    // lọc bbox, phân loại hàng nghìn điểm cho nhiều lớp cùng lúc (Promise.all)
    // vẫn có thể chiếm luồng JS liên tục vài giây; nhường quyền xen kẽ để
    // các thao tác chạm (chuyển tab...) vẫn được xử lý trong lúc tính.
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
  } catch {
    // Không đọc được (quyền truy cập/mạng) — coi collection này là "không
    // phân loại được theo khu vực", không làm hỏng cả bảng tổng hợp.
  }
  return counts;
}

export type TrendPoint = { date: string; label: string; count: number };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * `anchorIso` (YYYY-MM-DD) là ngày CUỐI của khoảng — mặc định hôm nay khi bỏ
 * trống. Dùng để "Xu hướng cập nhật" tính lùi từ một mốc ngày do người dùng
 * chọn (ô lọc "ngày") thay vì luôn cố định là hôm nay.
 */
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

/**
 * Xuất công khai để UI gọi lại riêng khi người dùng đổi khoảng ngày của
 * biểu đồ "Xu hướng cập nhật" (7/14/30 ngày) — dùng lại layerStats đã có
 * trong state thay vì phải chạy lại toàn bộ fetchStatisticsOverview().
 */
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

/** Trend riêng cho 1 collection cụ thể đang được chọn ở ô lọc "lớp". */
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
  labelKey: string;
  icon: IconName;
  /** null nếu KHÔNG có collection nào trong nhóm đọc được. */
  count: number | null;
  freshness: LayerFreshness;
  percentOfTotal: number;
};

const FRESHNESS_PRIORITY: Record<LayerFreshness, number> = {
  recent: 0,
  stale: 1,
  unknown: 2,
};

/**
 * `getCount` cho phép tính nhóm theo TOÀN BỘ bản ghi của layer (mặc định)
 * HOẶC theo số bản ghi đã lọc theo phường/xã (khi người dùng chọn 1 khu
 * vực) — dùng chung 1 hàm cho cả 2 trường hợp thay vì viết lặp lại.
 */
function computeGroups(
  groupConfigs: OverviewGroupConfig[],
  layerStats: LayerStat[],
  totalRecords: number,
  getCount: (stat: LayerStat) => number | null = stat => stat.count,
): GroupStat[] {
  const byId = new Map(layerStats.map(stat => [stat.layerId, stat]));
  const groups = groupConfigs.map(group => {
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
      id: group.id,
      labelKey: group.labelKey,
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
  /** Tổng hợp CỘNG DỒN TỪ TOÀN BỘ 15 collection, phân loại bằng hình học
   * (trừ thua_dat dùng ten_xa) — không còn chỉ dựa vào thua_dat như trước. */
  wardBreakdown: WardBreakdownItem[];
  wardUnassignedCount: number;
  trend: TrendPoint[];
  groups: GroupStat[];
  layerStats: LayerStat[];
  /** layerId -> (wardKey chuẩn hoá -> số bản ghi) — ma trận lớp × phường/xã,
   * tính 1 lần lúc tải overview. Dùng để tra cứu tức thời khi người dùng đổi
   * bộ lọc lớp/phường/xã ở UI, không cần gọi lại API. */
  layerWardCounts: Map<string, Map<string, number>>;
  /** wardKey chuẩn hoá -> tên hiển thị (ward rút gọn + fullName đầy đủ). */
  wardDirectory: Map<string, { ward: string; fullName: string }>;
  generatedAt: string;
};

export async function fetchStatisticsOverview(): Promise<StatisticsOverview> {
  const [layerStats, wardResult] = await Promise.all([
    Promise.all(BUSINESS_MVT_LAYERS.map(fetchLayerStat)),
    fetchWardBreakdown(),
  ]);
  const trend = await fetchTrend(layerStats);

  const wardShapes = await loadWardShapes(wardResult.items);
  const wardDirectory = new Map(
    wardShapes.map(s => [s.key, { ward: s.ward, fullName: s.fullName }]),
  );

  const layerWardCounts = new Map<string, Map<string, number>>();

  const thuaDatLayer = BUSINESS_MVT_LAYERS.find(l => l.collection === WARD_COLLECTION);
  if (thuaDatLayer) {
    const m = new Map<string, number>();
    for (const item of wardResult.items) {
      m.set(normalizeWardKey(item.fullName), item.count);
    }
    layerWardCounts.set(thuaDatLayer.id, m);
  }

  const otherLayers = BUSINESS_MVT_LAYERS.filter(l => l.collection !== WARD_COLLECTION);
  const otherCounts = await Promise.all(
    otherLayers.map(layer => fetchGeometricWardCounts(layer.collection, wardShapes)),
  );
  otherLayers.forEach((layer, i) => layerWardCounts.set(layer.id, otherCounts[i]));

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

  const totalRecords = layerStats.reduce((sum, stat) => sum + (stat.count ?? 0), 0);
  const totalClassified = wardBreakdown.reduce((sum, item) => sum + item.count, 0);
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
    totalLayers: BUSINESS_MVT_LAYERS.length,
    readableLayers,
    statusBuckets: [
      bucketTotals.get('recent')!,
      bucketTotals.get('stale')!,
      bucketTotals.get('unknown')!,
    ],
    wardBreakdown,
    wardUnassignedCount,
    trend,
    groups: computeGroups(DATA_OVERVIEW_GROUPS, layerStats, totalRecords),
    layerStats,
    layerWardCounts,
    wardDirectory,
    generatedAt: new Date().toISOString(),
  };
}

// ===== Tra cứu/số liệu ĐỘNG theo bộ lọc lớp + phường/xã đang chọn =====
// Toàn bộ hàm dưới đây là HÀM THUẦN (không gọi API) — dùng lại layerWardCounts
// đã tính sẵn trong StatisticsOverview, nên đổi lớp/phường ở UI không cần
// gọi lại API nào (trừ khi cần lọc thêm theo "tính đến ngày", xem
// fetchLayerAsOfCount bên dưới — KHÔNG kết hợp được với lọc phường/xã, xem
// ghi chú tại đó).

/** Tổng số bản ghi của 1 phường/xã, cộng dồn qua toàn bộ layer. */
export function getWardTotal(overview: StatisticsOverview, wardKey: string): number {
  let total = 0;
  for (const perLayer of overview.layerWardCounts.values()) {
    total += perLayer.get(wardKey) ?? 0;
  }
  return total;
}

/** 3 ô trạng thái + donut, lọc theo 1 phường/xã (cộng dồn qua toàn bộ layer). */
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

/** "Top lớp dữ liệu" xếp hạng lại theo 1 phường/xã đang chọn. */
export function computeWardScopedGroups(
  overview: StatisticsOverview,
  wardKey: string,
): GroupStat[] {
  return computeGroups(
    DATA_OVERVIEW_GROUPS,
    overview.layerStats,
    getWardTotal(overview, wardKey),
    stat => overview.layerWardCounts.get(stat.layerId)?.get(wardKey) ?? 0,
  );
}

/** "Theo phường, xã" của riêng 1 layer đang chọn — tra thẳng ma trận, không gọi API. */
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

/**
 * Đếm 1 collection cụ thể, lọc "tính đến ngày" (date_updated <= asOfDate) —
 * CHỈ áp dụng khi KHÔNG lọc theo phường/xã. Lý do: số theo phường/xã lấy từ
 * ma trận tính sẵn bằng hình học (chỉ có geom, không kèm ngày cập nhật của
 * từng bản ghi); kết hợp chính xác cả hai cần tải thêm geom+date_updated
 * cùng lúc rồi lọc lại 2 lần trên client — vượt quá nhu cầu thực tế của màn
 * hình này nên bỏ qua, khi cả 2 bộ lọc cùng chọn thì ưu tiên số theo phường
 * xã (không lọc theo ngày), có ghi chú rõ ở UI.
 */
export async function fetchLayerAsOfCount(
  layerId: string,
  collection: string,
  asOfDate: string,
): Promise<{ count: number | null; maxUpdatedAt: string | null; freshness: LayerFreshness }> {
  const hasDateField = DATE_TRACKED_LAYER_IDS.has(layerId);
  try {
    const params: Record<string, string> = { 'aggregate[count]': '*' };
    if (hasDateField) {
      params['aggregate[max]'] = DATE_FIELD_NAME;
      params[`filter[${DATE_FIELD_NAME}][_lte]`] = `${asOfDate}T23:59:59`;
    }
    const response = await dcuAxios.get<{
      data: Array<{ count?: string; max?: { [DATE_FIELD_NAME]?: string | null } }>;
    }>(dcuItemsUrl(collection), { params, headers: dcuHeaders() });
    const row = response.data.data?.[0];
    const raw = row?.count;
    const count = raw === undefined ? NaN : Number(raw);
    const maxUpdatedAt = hasDateField ? (row?.max?.[DATE_FIELD_NAME] ?? null) : null;
    const freshness = classifyFreshness(maxUpdatedAt);
    return { count: Number.isFinite(count) ? count : null, maxUpdatedAt, freshness };
  } catch {
    return { count: null, maxUpdatedAt: null, freshness: 'unknown' };
  }
}

/** Layer có field date_updated thật (dùng để UI biết có nên gọi trend/asOf hay không, không cần fetch thêm). */
export function layerHasDateField(layerId: string): boolean {
  return DATE_TRACKED_LAYER_IDS.has(layerId);
}

export { normalizeWardKey };
