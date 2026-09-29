import axios from 'axios';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { TIMEOUT } from '../../constants/url';
import { cachedFetch, type CachedResult } from '../cache/diskCache';
import { getRegistryVersion } from '../map/mapRegistry';

/**
 * Danh mục dùng chung /catalog/* (tài liệu mục 6): công khai, hầu như không
 * đổi -> cache xuống đĩa theo registryVersion (tài liệu mục 11), mất mạng thì
 * dùng bản đã lưu. Mỗi version chỉ tải một lần trong phiên.
 */

export type CatalogWard = {
  /** Mã ĐVHC — khoá bất biến, dùng cho ?wards=; không dùng tên làm khoá. */
  code: string;
  name: string;
  type: 'phuong' | 'xa' | 'thi_tran';
  areaKm2?: number | null;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number] | null;
};

/** Thuộc tính một feature của GET /catalog/wards/geojson. */
export type WardBoundaryProperties = {
  code: string;
  name: string;
  type: CatalogWard['type'];
  areaKm2: number | null;
  color?: string | null;
  population?: number | string | null;
  geographicPosition?: string | null;
  officeAddress?: string | null;
};

export type WardBoundaryCollection = FeatureCollection<
  Polygon | MultiPolygon,
  WardBoundaryProperties
>;

/** Gộp lời gọi theo (khoá, version) — tránh tải trùng trong một phiên. */
const memo = new Map<string, Promise<CachedResult<unknown>>>();

function cachedCatalog<T>(
  key: string,
  load: () => Promise<T>,
  storage: 'kv' | 'file' = 'kv',
): Promise<CachedResult<T>> {
  return getRegistryVersion()
    .catch(() => null)
    .then(version => {
      const memoKey = `${key}@${version ?? '?'}`;
      let request = memo.get(memoKey) as Promise<CachedResult<T>> | undefined;
      if (!request) {
        request = cachedFetch({ key, version, load, storage });
        request.catch(() => memo.delete(memoKey));
        memo.set(memoKey, request as Promise<CachedResult<unknown>>);
      }
      return request;
    });
}

/** Chỉ dùng trong test. */
export function resetCatalogMemoForTests() {
  memo.clear();
}

/** GET /catalog/wards — 40 phường xã. */
export function fetchCatalogWards(): Promise<CatalogWard[]> {
  return cachedCatalog('catalog-wards', async () => {
    const response = await axios.get<{ data: CatalogWard[] }>(
      `${DCU_API_BASE_URL}/catalog/wards`,
      { timeout: TIMEOUT },
    );
    return (response.data.data ?? []).map(ward => ({
      code: String(ward.code),
      name: ward.name,
      type: ward.type,
      areaKm2: ward.areaKm2 ?? null,
      bbox: ward.bbox ?? null,
    }));
  }).then(result => result.data);
}

/** Một trạng thái vòng đời — dùng đúng `color` do API trả (tài liệu mục 6). */
export type CatalogStatus = { code: string; label: string; color: string };

/**
 * GET /catalog/statuses[?collectionKey=] — bộ chung 9 trạng thái, hoặc bộ
 * riêng của một lớp (server tự rơi về bộ chung khi lớp chưa cấu hình riêng).
 */
export function fetchCatalogStatuses(
  collectionKey?: string | null,
): Promise<CatalogStatus[]> {
  return cachedCatalog(
    `catalog-statuses-${collectionKey ?? 'all'}`,
    async () => {
      const response = await axios.get<{ data: CatalogStatus[] }>(
        `${DCU_API_BASE_URL}/catalog/statuses`,
        {
          timeout: TIMEOUT,
          params: collectionKey ? { collectionKey } : undefined,
        },
      );
      return (response.data.data ?? []).map(status => ({
        code: String(status.code),
        label: status.label,
        color: status.color,
      }));
    },
  ).then(result => result.data);
}

/**
 * GET /catalog/wards/geojson — ranh giới 40 phường xã (FeatureCollection ở
 * mức gốc, ~4 MB). Bắt buộc cache (tài liệu mục 5, 11): lưu thành file, chỉ
 * tải lại khi registryVersion đổi. Kết quả kèm cờ stale/syncedAt để màn
 * hình ghi rõ khi đang dùng bản đã lưu.
 */
export function fetchWardBoundaries(): Promise<
  CachedResult<WardBoundaryCollection>
> {
  return cachedCatalog(
    'catalog-wards-geojson',
    async () => {
      const response = await axios.get<WardBoundaryCollection>(
        `${DCU_API_BASE_URL}/catalog/wards/geojson`,
        // File lớn: cho thêm thời gian trên mạng chậm.
        { timeout: TIMEOUT * 4 },
      );
      return response.data;
    },
    'file',
  );
}

/** Tên ngắn để hiển thị trong ô lọc ("Phường Phú Xuân" -> "Phú Xuân"). */
export function shortWardName(name: string): string {
  return name.replace(/^(Phường|Xã|Thị trấn)\s+/i, '');
}
