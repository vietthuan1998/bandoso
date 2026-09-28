import axios from 'axios';
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IconName } from '../../components/common/Icon';
import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { TIMEOUT } from '../../constants/url';
import type {
  MvtGeometryKind,
  MvtGroupConfig,
  MvtLayerConfig,
} from './mvtLayers';

type RegistryGeometryType =
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon';

/** Một entry của GET /map/layers (chỉ các trường app đang dùng). */
export type RegistryLayer = {
  collectionKey: string;
  directusCollection?: string;
  sourceLayer?: string;
  tileUrl: string;
  label?: string;
  menuGroup: string;
  geometryTypes?: RegistryGeometryType[];
  minZoom?: number;
  maxZoom?: number;
  color: string;
  icon?: string;
  capabilities?: Partial<
    Record<'list' | 'detail' | 'search' | 'statistics', boolean>
  >;
  dimensions?: { updatedAtField?: string | null };
  featureIdField?: string;
  titleFields?: string[];
  detailFields?: string[];
  hiddenFields?: string[];
  fieldLabels?: Record<string, string>;
  valueLabels?: Record<string, Record<string, string>>;
  objectValueKeys?: Record<string, string>;
};

/** Một entry của GET /catalog/layer-groups. */
export type RegistryLayerGroup = { key: string; label: string; icon?: string };

type RegistryCache = {
  registryVersion: string;
  layers: RegistryLayer[];
  groups: RegistryLayerGroup[];
};

const REGISTRY_CACHE_KEY = '@huemaps/map-registry-cache-v2';

// Registry trả tên icon theo bộ Google Material Icons; app dùng Material
// Design Icons nên ánh xạ sang tên icon ngữ nghĩa của app (components/common/Icon).
const MATERIAL_ICON_TO_APP_ICON: Record<string, IconName> = {
  landscape: 'landscape',
  map: 'map',
  eco: 'environment',
  domain: 'buildings',
  settings_input_antenna: 'antenna',
  sensors: 'sensor',
  science: 'science',
  handshake: 'handshake',
  dataset: 'database',
  air: 'wind',
  rainy: 'rain',
  water: 'waterLevel',
};

export function resolveRegistryIcon(name: string | undefined): IconName {
  return (name && MATERIAL_ICON_TO_APP_ICON[name]) || 'layers';
}

const GEOMETRY_KIND: Record<RegistryGeometryType, MvtGeometryKind> = {
  Point: 'point',
  MultiPoint: 'point',
  LineString: 'linestring',
  MultiLineString: 'linestring',
  Polygon: 'polygon',
  MultiPolygon: 'polygon',
};

export function normalizeRegistryLayer(raw: RegistryLayer): MvtLayerConfig {
  const kinds = Array.from(
    new Set((raw.geometryTypes ?? []).map(type => GEOMETRY_KIND[type])),
  ).filter(Boolean);
  return {
    id: raw.collectionKey,
    collection: raw.directusCollection || raw.collectionKey,
    sourceLayer: raw.sourceLayer || raw.collectionKey,
    tileUrl: raw.tileUrl,
    label: raw.label || raw.collectionKey,
    groupKey: raw.menuGroup,
    // Registry không khai báo hình học -> vẽ đủ cả ba kiểu cho chắc.
    geometryTypes: kinds.length ? kinds : ['polygon', 'linestring', 'point'],
    color: raw.color,
    icon: resolveRegistryIcon(raw.icon),
    minzoom: raw.minZoom,
    maxzoom: raw.maxZoom,
    updatedAtField: raw.dimensions?.updatedAtField ?? null,
    featureIdField: raw.featureIdField || 'id',
    titleFields: raw.titleFields ?? [],
    detailFields: raw.detailFields ?? [],
    hiddenFields: raw.hiddenFields ?? [],
    fieldLabels: raw.fieldLabels ?? {},
    valueLabels: raw.valueLabels ?? {},
    objectValueKeys: raw.objectValueKeys ?? {},
    capabilities: {
      list: raw.capabilities?.list ?? true,
      detail: raw.capabilities?.detail ?? true,
      search: raw.capabilities?.search ?? true,
      statistics: raw.capabilities?.statistics ?? true,
    },
  };
}

/**
 * Nhóm theo thứ tự của /catalog/layer-groups, chỉ giữ nhóm có lớp. Lớp có
 * menuGroup chưa có trong catalog vẫn hiện (nhãn = key) thay vì bị ẩn mất.
 */
export function buildLayerGroups(
  layers: MvtLayerConfig[],
  catalogGroups: RegistryLayerGroup[],
): MvtGroupConfig[] {
  const usedKeys = new Set(layers.map(layer => layer.groupKey));
  const groups: MvtGroupConfig[] = catalogGroups
    .filter(group => usedKeys.has(group.key))
    .map(group => ({
      key: group.key,
      label: group.label,
      icon: resolveRegistryIcon(group.icon),
    }));
  const known = new Set(groups.map(group => group.key));
  for (const key of usedKeys) {
    if (!known.has(key)) {
      groups.push({ key, label: key, icon: 'layers' });
      known.add(key);
    }
  }
  return groups;
}

export type MapRegistryState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  layers: MvtLayerConfig[];
  groups: MvtGroupConfig[];
};

let state: MapRegistryState = { status: 'idle', layers: [], groups: [] };
const listeners = new Set<() => void>();
let inflight: Promise<MapRegistryState> | null = null;

function setState(next: MapRegistryState) {
  state = next;
  listeners.forEach(listener => listener());
}

function applyRegistry(registry: RegistryCache) {
  const layers = registry.layers.map(normalizeRegistryLayer);
  setState({
    status: 'ready',
    layers,
    groups: buildLayerGroups(layers, registry.groups),
  });
}

async function readCache(): Promise<RegistryCache | null> {
  try {
    const raw = await AsyncStorage.getItem(REGISTRY_CACHE_KEY);
    return raw ? (JSON.parse(raw) as RegistryCache) : null;
  } catch {
    return null;
  }
}

async function fetchLayerGroups(
  fallback: RegistryLayerGroup[],
): Promise<RegistryLayerGroup[]> {
  try {
    const response = await axios.get<{ data: RegistryLayerGroup[] }>(
      `${DCU_API_BASE_URL}/catalog/layer-groups`,
      { timeout: TIMEOUT },
    );
    return response.data.data ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Hiện ngay registry đã cache (nếu có), rồi poll /map/config/version (nhẹ) và
 * chỉ tải lại /map/layers + /catalog/layer-groups khi registryVersion đổi.
 * Các endpoint đều public. Lỗi mạng: giữ cache; chưa từng cache -> 'error'.
 */
async function load(): Promise<MapRegistryState> {
  if (state.status !== 'ready') {
    setState({ ...state, status: 'loading' });
  }
  const cached = await readCache();
  if (cached && state.status !== 'ready') applyRegistry(cached);

  try {
    const version = await axios.get<{ registryVersion: string }>(
      `${DCU_API_BASE_URL}/map/config/version`,
      { timeout: TIMEOUT },
    );
    if (cached && cached.registryVersion === version.data.registryVersion) {
      return state;
    }
    const [layersResponse, groups] = await Promise.all([
      axios.get<{ registryVersion: string; layers: RegistryLayer[] }>(
        `${DCU_API_BASE_URL}/map/layers`,
        { timeout: TIMEOUT },
      ),
      fetchLayerGroups(cached?.groups ?? []),
    ]);
    const registry: RegistryCache = {
      registryVersion: layersResponse.data.registryVersion,
      layers: layersResponse.data.layers ?? [],
      groups,
    };
    applyRegistry(registry);
    AsyncStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(registry)).catch(
      () => {},
    );
  } catch {
    if (state.status !== 'ready') {
      setState({ status: 'error', layers: [], groups: [] });
    }
  }
  return state;
}

/** Tải (lại) registry; các lời gọi trùng nhau dùng chung một lượt tải. */
export function loadMapRegistry(): Promise<MapRegistryState> {
  if (!inflight) {
    inflight = load().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Cho service (ngoài React): registry hiện có, tải lần đầu nếu chưa có. */
export async function getMapRegistry(): Promise<MapRegistryState> {
  return state.status === 'ready' ? state : loadMapRegistry();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;

/** Danh sách lớp + nhóm từ registry, dùng chung cho mọi màn hình. */
export function useMapRegistry(): MapRegistryState & {
  reload: () => Promise<MapRegistryState>;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    if (state.status === 'idle') loadMapRegistry();
  }, []);
  return { ...snapshot, reload: loadMapRegistry };
}

/** Chỉ dùng trong test: đưa store về trạng thái ban đầu. */
export function resetMapRegistryForTests() {
  state = { status: 'idle', layers: [], groups: [] };
  inflight = null;
}
