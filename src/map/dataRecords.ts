import axios from 'axios';
import { dcuAxios, dcuHeaders, dcuItemsUrl } from './dcuClient';
import { classifyFreshness, type LayerFreshness } from './freshness';
import { MVT_LAYERS, type MvtLayerConfig } from './mvtLayers';
import { pickFeatureTitle, pickFeatureWard } from './normalizeFeatureFields';
import {
  isSystemDirectusCollection,
  layerHasDateField,
} from './statisticsOverview';

/**
 * Nguồn dữ liệu cho tab "Dữ liệu" (DataScreen) — màn hình liệt kê/tìm kiếm
 * TỪNG BẢN GHI của các collection MVT (khác StatisticsScreen chỉ tổng hợp
 * số lượng). Cùng nguyên tắc "không dựng số minh hoạ" của
 * map/statisticsOverview.ts: mọi bản ghi đều lấy thật từ Directus Items API.
 *
 * CHUẨN HOÁ 1 LẦN CHO MỌI COLLECTION: thay vì switch/case theo từng
 * collection để biết "tiêu đề là field nào", "phường/xã là field nào"...,
 * dùng lại đúng 2 hàm "danh sách khoá ứng viên" đã có sẵn
 * (pickFeatureTitle/pickFeatureWard trong normalizeFeatureFields.ts) — field
 * nào khớp thì dùng, không thì bỏ qua, không cần biết trước tên collection.
 */

/** 14 collection nghiệp vụ hiển thị ở tab "Dữ liệu" — loại trừ collection hệ
 * thống Directus, cùng cách lọc BUSINESS_MVT_LAYERS của statisticsOverview.ts. */
export const DATA_SCREEN_LAYERS: MvtLayerConfig[] = MVT_LAYERS.filter(
  layer => !isSystemDirectusCollection(layer.collection),
);

/**
 * Tham số nút "Định vị trên bản đồ" của DataScreen truyền lên AppShell rồi
 * xuống HueMapScreen — đủ thông tin để HueMapScreen bật đúng lớp MVT, chọn
 * đúng đối tượng (hiện MvtFeaturePanel như khi chạm trực tiếp trên bản đồ)
 * rồi bay camera tới toạ độ, thay vì chỉ bay camera tới 1 điểm trống. Khai
 * báo dùng chung ở đây (thay vì lặp lại kiểu inline ở AppShell/HueMapScreen)
 * để 3 nơi luôn khớp kiểu.
 */
export type MapLocateRequest = {
  layerId: string;
  coordinates: [number, number];
  properties: Record<string, unknown>;
};

/**
 * Collection có field phường/xã dạng text ĐÃ XÁC NHẬN đáng tin cậy —
 * hiện chỉ `thua_dat.ten_xa` (xem ghi chú đầu map/statisticsOverview.ts).
 * Lọc theo phường/xã (server-side, qua Directus `filter[ten_xa][_eq]`) chỉ
 * áp dụng được cho các layer trong danh sách này — layer khác không có field
 * đáng tin cậy để lọc chính xác, xem fetchDataRecordsPage bên dưới.
 */
export const WARD_TRACKED_LAYER_IDS = new Set(['thua-dat']);

export type DataRecord = {
  /** id Directus của bản ghi (chuỗi — có thể là số hoặc uuid tuỳ collection). */
  id: string;
  layerId: string;
  collection: string;
  layerLabelKey: string;
  color: string;
  title: string;
  ward: string | null;
  updatedAt: string | null;
  /** 'unknown' khi collection không có field date_updated đáng tin cậy
   * (xem layerHasDateField) — KHÔNG suy đoán trạng thái khi không có mốc
   * thời gian thật. */
  status: LayerFreshness;
  /** Toàn bộ thuộc tính gốc — dùng cho popup chi tiết (normalizeFeatureFields). */
  properties: Record<string, unknown>;
};

/**
 * Tên field khoá chính hay gặp — Directus mặc định dùng "id", nhưng các
 * collection gisportal_* (bảng PostGIS import từ nguồn GIS ngoài, xem ghi
 * chú ở MVT_LAYERS trong data/mvtLayers.ts) có thể dùng tên cột khác tuỳ
 * công cụ import (ogr2ogr mặc định "ogc_fid", QGIS/ArcGIS hay dùng
 * "objectid"/"gid") — thử lần lượt thay vì giả định "id" luôn tồn tại, cùng
 * cách tiếp cận "danh sách khoá ứng viên" của pickFeatureTitle/pickFeatureWard.
 * Thiếu field này khiến mọi bản ghi của collection đó rơi về id "" giống
 * nhau — từng gây lỗi React "two children with the same key" khi gộp danh
 * sách (xem thêm keyExtractor dự phòng theo index ở DataScreen).
 */
const ID_FIELD_CANDIDATES = ['id', 'gid', 'objectid', 'ogc_fid', 'fid', 'pk'];

/** Export để HueMapScreen dùng lại — cần suy ra id từ properties LẤY TỪ TILE
 * MVT khi chạm trực tiếp 1 đối tượng trên bản đồ (không có tên field cố
 * định, cùng lý do nêu trên), để gọi fetchRecordById() lấy đúng bản ghi gốc
 * (kèm geom) — xem HueMapScreen/index.tsx. */
export function pickRecordId(raw: Record<string, unknown>): string {
  for (const key of ID_FIELD_CANDIDATES) {
    const value = raw[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeRecord(
  layer: MvtLayerConfig,
  raw: Record<string, unknown>,
): DataRecord {
  const id = pickRecordId(raw);
  const rawUpdatedAt = raw.date_updated;
  const updatedAt =
    typeof rawUpdatedAt === 'string' && rawUpdatedAt.trim()
      ? rawUpdatedAt
      : null;
  return {
    id,
    layerId: layer.id,
    collection: layer.collection,
    layerLabelKey: layer.labelKey,
    color: layer.color,
    title: pickFeatureTitle(raw) ?? id ?? layer.collection,
    ward: pickFeatureWard(raw),
    updatedAt,
    status: layerHasDateField(layer.id)
      ? classifyFreshness(updatedAt)
      : 'unknown',
    properties: raw,
  };
}

export type DataRecordsUnreadableReason = 'forbidden' | 'error' | null;

export type DataRecordsPage = {
  items: DataRecord[];
  total: number;
  /**
   * null khi gọi thành công. 'forbidden' khi Directus trả 403 — một số
   * collection gisportal_* hiện trả 403 (tài khoản DCU_BEARER_TOKEN chưa
   * được cấp quyền đọc collection đó, xác nhận thật qua thử gọi trực tiếp
   * GET /items/<collection>). 'error' cho lỗi khác (mạng/timeout). Khác hẳn
   * `total: 0` (gọi được nhưng không bản ghi nào khớp bộ lọc) — UI cần phân
   * biệt rõ "không có quyền truy cập" với "không có dữ liệu phù hợp".
   */
  unreadableReason: DataRecordsUnreadableReason;
};

function unreadableReasonOf(error: unknown): DataRecordsUnreadableReason {
  return axios.isAxiosError(error) && error.response?.status === 403
    ? 'forbidden'
    : 'error';
}

/**
 * Tải 1 trang bản ghi THẬT của 1 collection cụ thể, có thể kèm tìm kiếm/lọc
 * phường-xã. `search` dùng tham số `search` chung của Directus (tìm trên mọi
 * field text của collection phía server) — KHÔNG cần biết trước tên field
 * nào để tìm, tránh phải switch/case theo từng collection.
 */
export async function fetchDataRecordsPage({
  layer,
  search = '',
  ward = null,
  page = 1,
  pageSize = 20,
}: {
  layer: MvtLayerConfig;
  search?: string;
  ward?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<DataRecordsPage> {
  // Layer không có field phường/xã đáng tin cậy -> không thể lọc chính xác,
  // trả rỗng thay vì lọc sai/bỏ qua bộ lọc trong im lặng.
  if (ward && !WARD_TRACKED_LAYER_IDS.has(layer.id)) {
    return { items: [], total: 0, unreadableReason: null };
  }
  try {
    const params: Record<string, string | number> = {
      limit: pageSize,
      page,
      meta: 'filter_count',
      sort: layerHasDateField(layer.id) ? '-date_updated' : '',
    };
    if (search.trim()) params.search = search.trim();
    if (ward) params['filter[ten_xa][_eq]'] = ward;

    const response = await dcuAxios.get<{
      data: Array<Record<string, unknown>>;
      meta?: { filter_count?: number };
    }>(dcuItemsUrl(layer.collection), { params, headers: dcuHeaders() });

    const items = (response.data.data ?? []).map(raw =>
      normalizeRecord(layer, raw),
    );
    const total = response.data.meta?.filter_count ?? items.length;
    return { items, total, unreadableReason: null };
  } catch (error) {
    return { items: [], total: 0, unreadableReason: unreadableReasonOf(error) };
  }
}

/**
 * Tải NGUYÊN 1 bản ghi thật theo id (Directus Items API, `fields=*` mặc
 * định — bao gồm cả `geom`) — dùng khi chọn 1 đối tượng TRỰC TIẾP trên bản
 * đồ (tile MVT chỉ mang `properties`, KHÔNG mang geometry gốc chính xác qua
 * event chạm, và có thể là dữ liệu cache/rút gọn — xem giải thích tại
 * HueMapScreen/index.tsx). Gọi lại bằng id để: (1) dữ liệu hiển thị ở
 * FeatureDetailScreen luôn khớp bản ghi gốc mới nhất dù mở từ đâu, (2) có
 * geom thật để vẽ nổi bật đúng hình dạng đối tượng lên bản đồ + bay camera
 * khung vừa đúng nó (fitBounds) thay vì chỉ bay tới 1 điểm đại diện.
 */
export async function fetchRecordById(
  layer: MvtLayerConfig,
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await dcuAxios.get<{ data: Record<string, unknown> }>(
      `${dcuItemsUrl(layer.collection)}/${encodeURIComponent(id)}`,
      { headers: dcuHeaders() },
    );
    return response.data.data ?? null;
  } catch {
    return null;
  }
}

export type AllLayersRecordsResult = DataRecordsPage & {
  /** id các lớp KHÔNG gọi được (403/lỗi khác) — bị loại khỏi danh sách gộp
   * thay vì làm hỏng cả danh sách; DataScreen dùng để báo hiệu riêng, không
   * lẫn với "không có dữ liệu phù hợp". */
  unreadableLayerIds: string[];
};

/**
 * Chế độ "Tất cả lớp" (không chọn collection cụ thể) — gộp 1 trang NHỎ từ
 * MỌI collection (song song) rồi xếp theo cập nhật gần nhất, thay vì phân
 * trang đầy đủ qua 14 collection cùng lúc (quá tốn cho 1 danh sách gộp).
 * Người dùng cần xem đầy đủ/tải thêm thì chọn đúng 1 lớp ở ô lọc.
 */
export async function fetchAllLayersRecords({
  search = '',
  ward = null,
  perLayerLimit = 6,
}: {
  search?: string;
  ward?: string | null;
  perLayerLimit?: number;
}): Promise<AllLayersRecordsResult> {
  const layers = ward
    ? DATA_SCREEN_LAYERS.filter(layer => WARD_TRACKED_LAYER_IDS.has(layer.id))
    : DATA_SCREEN_LAYERS;
  const results = await Promise.all(
    layers.map(async layer => ({
      layer,
      page: await fetchDataRecordsPage({
        layer,
        search,
        ward,
        page: 1,
        pageSize: perLayerLimit,
      }),
    })),
  );
  const items = results.flatMap(r => r.page.items);
  items.sort((a, b) => {
    if (a.updatedAt && b.updatedAt)
      return b.updatedAt.localeCompare(a.updatedAt);
    if (a.updatedAt) return -1;
    if (b.updatedAt) return 1;
    return 0;
  });
  const total = results.reduce((sum, r) => sum + r.page.total, 0);
  const unreadableLayerIds = results
    .filter(r => r.page.unreadableReason !== null)
    .map(r => r.layer.id);
  return { items, total, unreadableReason: null, unreadableLayerIds };
}
