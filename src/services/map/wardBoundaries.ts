import axios from 'axios';
import { DCU_API_BASE_URL } from '../../config/dcuAuthConfig';
import { TIMEOUT } from '../../constants/url';

export type WardBoundaryProperties = {
  code: string;
  name: string;
  type: 'phuong' | 'xa';
  areaKm2: number;
};

export type WardBoundaryCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  WardBoundaryProperties
>;

// File ~4 MB: cho thêm thời gian so với timeout mặc định của request thường.
const WARD_BOUNDARIES_TIMEOUT = Math.max(TIMEOUT, 60_000);

let request: Promise<WardBoundaryCollection> | null = null;

/**
 * GET /catalog/wards/geojson — FeatureCollection ranh giới 40 phường xã, trả ở
 * mức gốc (không bọc { data, meta }); id feature = mã ĐVHC. Tài liệu khuyên
 * cache vì file lớn: giữ trong bộ nhớ suốt phiên để mở lại màn hình không tải
 * lại. Lỗi thì bỏ cache để lần sau thử lại.
 */
export function loadWardBoundaries(): Promise<WardBoundaryCollection> {
  if (!request) {
    request = axios
      .get<WardBoundaryCollection>(`${DCU_API_BASE_URL}/catalog/wards/geojson`, {
        timeout: WARD_BOUNDARIES_TIMEOUT,
      })
      .then(response => response.data)
      .catch(error => {
        request = null;
        throw error;
      });
  }
  return request;
}
