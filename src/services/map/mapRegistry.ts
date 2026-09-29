import axios from 'axios';
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IconName } from '../../components/common/Icon';
import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { TIMEOUT } from '../../constants/url';
import {
  getAccessToken,
  subscribeToAccessTokenChange,
} from '../auth/authClient';
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
  directusIdField?: string;
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
  dimensions?: { updatedAtField?: string | null; measureFields?: string[] };
  featureIdField?: string;
  geometryField?: string;
  titleFields?: string[];
  searchableFields?: string[];
  listFields?: string[];
  detailFields?: string[];
  hiddenFields?: string[];
  fieldLabels?: Record<string, string>;
  valueLabels?: Record<string, Record<string, string>>;
  objectValueKeys?: Record<string, string>;
};

/** Một entry của GET /catalog/layer-groups. */
export type RegistryLayerGroup = { key: string; label: string; icon?: string };

/**
 * `public` = registry tải khi chưa đăng nhập; `auth` = tải kèm token (danh
 * sách lớp có thể hẹp lại theo quyền — tài liệu mục 1 bước 4, mục 10). Cache
 * của đối tượng này không được dùng cho đối tượng kia.
 */
type RegistryAudience = 'public' | 'auth';

type RegistryCache = {
  registryVersion: string;
  audience: RegistryAudience;
  /** Lần cuối xác nhận registry khớp server (ISO 8601). */
  syncedAt: string;
  layers: RegistryLayer[];
  groups: RegistryLayerGroup[];
};

const REGISTRY_CACHE_KEY = '@huemaps/map-registry-cache-v3';

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
    measureFields: raw.dimensions?.measureFields ?? [],
    featureIdField: raw.featureIdField || 'id',
    directusIdField: raw.directusIdField || raw.featureIdField || 'id',
    geometryField: raw.geometryField || 'geom',
    titleFields: raw.titleFields ?? [],
    searchableFields: raw.searchableFields ?? [],
    listFields: raw.listFields ?? [],
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
  /** Lần đồng bộ thành công gần nhất với server (ISO 8601), null nếu chưa có. */
  syncedAt?: string | null;
  /** true = đang hiển thị bản đã lưu vì lần đồng bộ mới nhất thất bại. */
  stale?: boolean;
};

let state: MapRegistryState = { status: 'idle', layers: [], groups: [] };
const listeners = new Set<() => void>();
let inflight: Promise<MapRegistryState> | null = null;
let reloadQueued = false;
/** Đối tượng (public/auth) của registry đang hiển thị. */
let stateAudience: RegistryAudience | null = null;

function setState(next: MapRegistryState) {
  state = next;
  listeners.forEach(listener => listener());
}

function applyRegistry(registry: RegistryCache, stale: boolean) {
  stateAudience = registry.audience;
  const layers = registry.layers.map(normalizeRegistryLayer);
  setState({
    status: 'ready',
    layers,
    groups: buildLayerGroups(layers, registry.groups),
    syncedAt: registry.syncedAt,
    stale,
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

function writeCache(registry: RegistryCache) {
  AsyncStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(registry)).catch(
    () => {},
  );
}

function authConfig() {
  const accessToken = getAccessToken();
  return {
    audience: (accessToken ? 'auth' : 'public') as RegistryAudience,
    config: {
      timeout: TIMEOUT,
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    },
  };
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
 * Hiện ngay registry đã cache (nếu cùng đối tượng public/auth), rồi poll
 * /map/config/version (nhẹ) và chỉ tải lại /map/layers + /catalog/layer-groups
 * khi registryVersion đổi. Đã đăng nhập thì gửi kèm token. Lỗi mạng: giữ bản
 * đã lưu và đánh dấu `stale`; chưa từng cache -> 'error'.
 */
async function load(): Promise<MapRegistryState> {
  const { audience, config } = authConfig();
  const cachedAny = await readCache();
  const cached = cachedAny?.audience === audience ? cachedAny : null;

  if (state.status !== 'ready') {
    setState({ ...state, status: 'loading' });
  }
  if (cached && (state.status !== 'ready' || stateAudience !== audience)) {
    applyRegistry(cached, false);
  }

  try {
    const version = await axios.get<{ registryVersion: string }>(
      `${DCU_API_BASE_URL}/map/config/version`,
      config,
    );
    const syncedAt = new Date().toISOString();
    if (cached && cached.registryVersion === version.data.registryVersion) {
      // Giữ nguyên mảng layers (tránh các màn hình tải lại dữ liệu vô ích),
      // chỉ cập nhật thời điểm đồng bộ.
      setState({ ...state, syncedAt, stale: false });
      writeCache({ ...cached, syncedAt });
      return state;
    }
    const [layersResponse, groups] = await Promise.all([
      axios.get<{ registryVersion: string; layers: RegistryLayer[] }>(
        `${DCU_API_BASE_URL}/map/layers`,
        config,
      ),
      fetchLayerGroups(cachedAny?.groups ?? []),
    ]);
    const registry: RegistryCache = {
      registryVersion: layersResponse.data.registryVersion,
      audience,
      syncedAt,
      layers: layersResponse.data.layers ?? [],
      groups,
    };
    applyRegistry(registry, false);
    writeCache(registry);
  } catch {
    if (state.status === 'ready') {
      setState({ ...state, stale: true });
    } else {
      setState({ status: 'error', layers: [], groups: [] });
    }
  }
  return state;
}

/**
 * Tải (lại) registry; các lời gọi trùng nhau dùng chung một lượt tải.
 * `force` = phải tải lại sau lượt đang chạy (vd. vừa đăng nhập/đăng xuất).
 */
export function loadMapRegistry(
  options: { force?: boolean } = {},
): Promise<MapRegistryState> {
  if (inflight) {
    if (!options.force) return inflight;
    reloadQueued = true;
    return inflight.then(() => loadMapRegistry());
  }
  reloadQueued = false;
  inflight = load().finally(() => {
    inflight = null;
  });
  return inflight;
}

// Đăng nhập / đăng xuất -> danh sách lớp có thể khác theo quyền: tải lại
// registry kèm token mới (tài liệu mục 1 bước 4). Refresh token (vẫn đăng
// nhập) không đổi đối tượng nên không cần tải lại.
let lastAudience: RegistryAudience = getAccessToken() ? 'auth' : 'public';
subscribeToAccessTokenChange(accessToken => {
  const audience: RegistryAudience = accessToken ? 'auth' : 'public';
  if (audience === lastAudience) return;
  lastAudience = audience;
  if (state.status !== 'idle' && !reloadQueued) {
    loadMapRegistry({ force: true }).catch(() => {});
  }
});

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
  return { ...snapshot, reload: () => loadMapRegistry({ force: true }) };
}

/** Chỉ dùng trong test: đưa store về trạng thái ban đầu. */
export function resetMapRegistryForTests() {
  state = { status: 'idle', layers: [], groups: [] };
  inflight = null;
  reloadQueued = false;
  stateAudience = null;
}
