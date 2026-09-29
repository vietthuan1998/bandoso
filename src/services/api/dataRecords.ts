import { dcuAxios, dcuHeaders, dcuItemsUrl } from './dcuClient';
import { isForbidden, parseApiError } from './apiError';
import { getMapRegistry } from '../map/mapRegistry';
import type { MvtLayerConfig } from '../map/mvtLayers';
import {
  resolveFeatureTitle,
  resolveFieldValue,
} from '../gis/registryFeatureFields';
import type { FieldLabels } from '../gis/normalizeFeatureFields';
import { isSystemDirectusCollection } from '../statistics/statisticsOverview';
import { fetchStatisticsGroups } from '../statistics/statisticsApi';

/**
 * Màn Dữ liệu đọc thẳng items Directus vì BFF chưa có endpoint danh sách bản
 * ghi (docs/designs/huemaps-bff-migration.md). Mọi tên field lấy từ registry
 * (directusIdField, titleFields, listFields, searchableFields, updatedAtField)
 * — không khai báo cứng trong client (tài liệu mục 4).
 */

// Lớp hiện ở màn Dữ liệu: registry bật capabilities.list, bỏ collection hệ thống.
export function dataScreenLayers(layers: MvtLayerConfig[]): MvtLayerConfig[] {
  return layers.filter(
    layer =>
      layer.capabilities.list && !isSystemDirectusCollection(layer.collection),
  );
}

export type MapLocateRequest = {
  layerId: string;
  coordinates: [number, number];
  properties: Record<string, unknown>;
};

/** Bộ lọc dùng chung giữa màn Dữ liệu và Thống kê (tài liệu mục 11). */
export type DataFilters = {
  /** Mã ĐVHC; rỗng = mọi phường xã. */
  wards: string[];
  /** yyyy-mm-dd; null = không giới hạn. */
  dateFrom: string | null;
  dateTo: string | null;
};

export type DataRecordLine = { key: string; label: string; value: string };

export type DataRecord = {
  id: string;
  layerId: string;
  collection: string;
  color: string;
  title: string;
  /** Các cột listFields (trừ trường đã làm tiêu đề), theo đúng thứ tự registry. */
  lines: DataRecordLine[];
  updatedAt: string | null;
  properties: Record<string, unknown>;
};

export function recordId(
  layer: MvtLayerConfig,
  raw: Record<string, unknown>,
): string {
  const value = raw[layer.directusIdField];
  return value !== null && value !== undefined && String(value).trim()
    ? String(value).trim()
    : '';
}

export function normalizeRecord(
  layer: MvtLayerConfig,
  raw: Record<string, unknown>,
  labels: FieldLabels,
): DataRecord {
  const title = resolveFeatureTitle(layer, raw);
  const hidden = new Set(layer.hiddenFields);
  const titleField = layer.titleFields.find(
    field => resolveFieldValue(layer, field, raw, labels) === title,
  );
  const lines = layer.listFields
    .filter(field => field !== titleField && !hidden.has(field))
    .map(field => ({
      key: field,
      label: layer.fieldLabels[field] ?? field,
      value: resolveFieldValue(layer, field, raw, labels),
    }))
    .filter(line => line.value !== '');
  const rawUpdatedAt = layer.updatedAtField ? raw[layer.updatedAtField] : null;
  return {
    id: recordId(layer, raw),
    layerId: layer.id,
    collection: layer.collection,
    color: layer.color,
    title,
    lines,
    updatedAt:
      typeof rawUpdatedAt === 'string' && rawUpdatedAt.trim()
        ? rawUpdatedAt
        : null,
    properties: raw,
  };
}

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const wardFieldRequests = new Map<string, Promise<string | null>>();

/**
 * Trường chứa mã ĐVHC của lớp, lấy từ `field` mà server trả ở
 * /statistics/{key}/groups?dimension=ward (vd. thua_dat -> ma_xa). Lớp không
 * có trường phường xã thật (server trả "(chỉ mục địa bàn)") hoặc chưa đăng
 * nhập -> null: danh sách Directus không lọc được theo phường xã cho lớp đó.
 */
export function resolveWardField(layer: MvtLayerConfig): Promise<string | null> {
  let request = wardFieldRequests.get(layer.id);
  if (!request) {
    request = fetchStatisticsGroups(layer.id, 'ward', {})
      .then(result => (IDENTIFIER_RE.test(result.field) ? result.field : null))
      .catch(() => {
        // Lỗi quyền/mạng không được ghim vĩnh viễn — lần sau hỏi lại.
        wardFieldRequests.delete(layer.id);
        return null;
      });
    wardFieldRequests.set(layer.id, request);
  }
  return request;
}

/** Chỉ dùng trong test. */
export function resetWardFieldCacheForTests() {
  wardFieldRequests.clear();
}

export type LayerFilterSupport = {
  wards: boolean;
  dates: boolean;
  search: boolean;
};

type DirectusFilter = Record<string, unknown>;

async function buildLayerQuery(
  layer: MvtLayerConfig,
  search: string,
  filters: DataFilters,
): Promise<{ filter: DirectusFilter | null; support: LayerFilterSupport }> {
  const clauses: DirectusFilter[] = [];
  const support: LayerFilterSupport = { wards: true, dates: true, search: true };

  const query = search.trim();
  if (query) {
    if (layer.capabilities.search && layer.searchableFields.length > 0) {
      clauses.push({
        _or: layer.searchableFields.map(field => ({
          [field]: { _icontains: query },
        })),
      });
    } else {
      support.search = false;
    }
  }

  if (filters.wards.length > 0) {
    const wardField = await resolveWardField(layer);
    if (wardField) {
      clauses.push({ [wardField]: { _in: filters.wards } });
    } else {
      support.wards = false;
    }
  }

  if (filters.dateFrom || filters.dateTo) {
    if (layer.updatedAtField) {
      const range: Record<string, string> = {};
      if (filters.dateFrom) range._gte = `${filters.dateFrom}T00:00:00`;
      if (filters.dateTo) range._lte = `${filters.dateTo}T23:59:59`;
      clauses.push({ [layer.updatedAtField]: range });
    } else {
      support.dates = false;
    }
  }

  return {
    filter: clauses.length ? { _and: clauses } : null,
    support,
  };
}

function isSupported(support: LayerFilterSupport): boolean {
  return support.wards && support.dates && support.search;
}

export type DataRecordsUnreadableReason = 'forbidden' | 'error' | null;

export type DataRecordsPage = {
  items: DataRecord[];
  total: number;
  unreadableReason: DataRecordsUnreadableReason;
  /** Bộ lọc/tìm kiếm không áp dụng được cho lớp này -> không trả bản ghi. */
  unsupported: LayerFilterSupport | null;
};

function unreadableReasonOf(error: unknown): DataRecordsUnreadableReason {
  return isForbidden(parseApiError(error)) ? 'forbidden' : 'error';
}

export async function fetchDataRecordsPage({
  layer,
  search = '',
  filters,
  labels,
  page = 1,
  pageSize = 20,
}: {
  layer: MvtLayerConfig;
  search?: string;
  filters: DataFilters;
  labels: FieldLabels;
  page?: number;
  pageSize?: number;
}): Promise<DataRecordsPage> {
  const { filter, support } = await buildLayerQuery(layer, search, filters);
  // Không lọc được thì không trả gì — trả toàn bộ sẽ trông như đã lọc.
  if (!isSupported(support)) {
    return { items: [], total: 0, unreadableReason: null, unsupported: support };
  }
  try {
    const params: Record<string, string | number> = {
      limit: pageSize,
      page,
      meta: 'filter_count',
    };
    if (layer.updatedAtField) params.sort = `-${layer.updatedAtField}`;
    if (filter) params.filter = JSON.stringify(filter);

    const response = await dcuAxios.get<{
      data: Array<Record<string, unknown>>;
      meta?: { filter_count?: number };
    }>(dcuItemsUrl(layer.collection), { params, headers: dcuHeaders() });

    const items = (response.data.data ?? []).map(raw =>
      normalizeRecord(layer, raw, labels),
    );
    const total = response.data.meta?.filter_count ?? items.length;
    return { items, total, unreadableReason: null, unsupported: null };
  } catch (error) {
    return {
      items: [],
      total: 0,
      unreadableReason: unreadableReasonOf(error),
      unsupported: null,
    };
  }
}

/**
 * Bản ghi đầy đủ của một feature bấm trên bản đồ. Khoá tile là
 * featureIdField; khoá Directus là directusIdField — hai trường có thể khác
 * nhau (vd. gisportal_* dùng objectid trong tile), khi đó tra theo filter.
 */
export async function fetchFeatureRecord(
  layer: MvtLayerConfig,
  featureId: string,
): Promise<Record<string, unknown> | null> {
  try {
    if (layer.directusIdField === layer.featureIdField) {
      const response = await dcuAxios.get<{ data: Record<string, unknown> }>(
        `${dcuItemsUrl(layer.collection)}/${encodeURIComponent(featureId)}`,
        { headers: dcuHeaders() },
      );
      return response.data.data ?? null;
    }
    const response = await dcuAxios.get<{
      data: Array<Record<string, unknown>>;
    }>(dcuItemsUrl(layer.collection), {
      params: {
        limit: 1,
        filter: JSON.stringify({ [layer.featureIdField]: { _eq: featureId } }),
      },
      headers: dcuHeaders(),
    });
    return response.data.data?.[0] ?? null;
  } catch {
    return null;
  }
}

export type AllLayersRecordsResult = {
  items: DataRecord[];
  total: number;
  unreadableLayerIds: string[];
  unsupportedLayerIds: string[];
};

export async function fetchAllLayersRecords({
  search = '',
  filters,
  labels,
  perLayerLimit = 6,
}: {
  search?: string;
  filters: DataFilters;
  labels: FieldLabels;
  perLayerLimit?: number;
}): Promise<AllLayersRecordsResult> {
  const layers = dataScreenLayers((await getMapRegistry()).layers);
  const results = await Promise.all(
    layers.map(async layer => ({
      layer,
      page: await fetchDataRecordsPage({
        layer,
        search,
        filters,
        labels,
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
  return {
    items,
    total: results.reduce((sum, r) => sum + r.page.total, 0),
    unreadableLayerIds: results
      .filter(r => r.page.unreadableReason !== null)
      .map(r => r.layer.id),
    unsupportedLayerIds: results
      .filter(r => r.page.unsupported !== null)
      .map(r => r.layer.id),
  };
}
