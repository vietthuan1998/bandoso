import axios from 'axios';
import { dcuAxios, dcuHeaders, dcuItemsUrl } from './dcuClient';
import { classifyFreshness, type LayerFreshness } from './freshness';
import { MVT_LAYERS, type MvtLayerConfig } from './mvtLayers';
import { pickFeatureTitle, pickFeatureWard } from './normalizeFeatureFields';
import {
  isSystemDirectusCollection,
  layerHasDateField,
} from './statisticsOverview';

export const DATA_SCREEN_LAYERS: MvtLayerConfig[] = MVT_LAYERS.filter(
  layer => !isSystemDirectusCollection(layer.collection),
);

export type MapLocateRequest = {
  layerId: string;
  coordinates: [number, number];
  properties: Record<string, unknown>;
};

export const WARD_TRACKED_LAYER_IDS = new Set(['thua-dat']);

export type DataRecord = {
  id: string;
  layerId: string;
  collection: string;
  layerLabelKey: string;
  color: string;
  title: string;
  ward: string | null;
  updatedAt: string | null;
  status: LayerFreshness;
  properties: Record<string, unknown>;
};

const ID_FIELD_CANDIDATES = ['id', 'gid', 'objectid', 'ogc_fid', 'fid', 'pk'];

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
  unreadableReason: DataRecordsUnreadableReason;
};

function unreadableReasonOf(error: unknown): DataRecordsUnreadableReason {
  return axios.isAxiosError(error) && error.response?.status === 403
    ? 'forbidden'
    : 'error';
}

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
  unreadableLayerIds: string[];
};

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
