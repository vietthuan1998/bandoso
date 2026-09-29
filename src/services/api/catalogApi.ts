import axios from 'axios';
import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { TIMEOUT } from '../../constants/url';

export type CatalogWard = {
  /** Mã ĐVHC — khoá bất biến, dùng cho ?wards=; không dùng tên làm khoá. */
  code: string;
  name: string;
  type: 'phuong' | 'xa' | 'thi_tran';
  areaKm2?: number | null;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number] | null;
};

let wardsRequest: Promise<CatalogWard[]> | null = null;

/** GET /catalog/wards — public, gần như tĩnh: tải một lần mỗi phiên. */
export function fetchCatalogWards(): Promise<CatalogWard[]> {
  if (!wardsRequest) {
    wardsRequest = axios
      .get<{ data: CatalogWard[] }>(`${DCU_API_BASE_URL}/catalog/wards`, {
        timeout: TIMEOUT,
      })
      .then(response =>
        (response.data.data ?? []).map(ward => ({
          code: String(ward.code),
          name: ward.name,
          type: ward.type,
          areaKm2: ward.areaKm2 ?? null,
          bbox: ward.bbox ?? null,
        })),
      )
      .catch(error => {
        wardsRequest = null;
        throw error;
      });
  }
  return wardsRequest;
}

/** Một trạng thái vòng đời — dùng đúng `color` do API trả (tài liệu mục 6). */
export type CatalogStatus = { code: string; label: string; color: string };

const statusRequests = new Map<string, Promise<CatalogStatus[]>>();

/**
 * GET /catalog/statuses[?collectionKey=] — bộ chung 9 trạng thái, hoặc bộ
 * riêng của một lớp (server tự rơi về bộ chung khi lớp chưa cấu hình riêng).
 */
export function fetchCatalogStatuses(
  collectionKey?: string | null,
): Promise<CatalogStatus[]> {
  const cacheKey = collectionKey ?? '';
  let request = statusRequests.get(cacheKey);
  if (!request) {
    request = axios
      .get<{ data: CatalogStatus[] }>(`${DCU_API_BASE_URL}/catalog/statuses`, {
        timeout: TIMEOUT,
        params: collectionKey ? { collectionKey } : undefined,
      })
      .then(response =>
        (response.data.data ?? []).map(status => ({
          code: String(status.code),
          label: status.label,
          color: status.color,
        })),
      )
      .catch(error => {
        statusRequests.delete(cacheKey);
        throw error;
      });
    statusRequests.set(cacheKey, request);
  }
  return request;
}

/** Tên ngắn để hiển thị trong ô lọc ("Phường Phú Xuân" -> "Phú Xuân"). */
export function shortWardName(name: string): string {
  return name.replace(/^(Phường|Xã|Thị trấn)\s+/i, '');
}
