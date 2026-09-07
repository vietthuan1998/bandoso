/**
 * Bước thử nghiệm/kiểm chứng đường ống vẽ MVT (Mapbox Vector Tile) theo mục 8
 * và 10.1 của ĐẶC TẢ KỸ THUẬT HỆ THỐNG (mota/MO_TA_KY_THUAT_...docx):
 *
 *   "Toàn bộ lớp nghiệp vụ trong phạm vi phải được vẽ từ:
 *    https://dcu.huecity.vn/mvt/{z}/{x}/{y}.mvt?collections=${collection}"
 *
 * Tài liệu liệt kê 14 collection và yêu cầu client dùng registry động lấy từ
 * backend (/api/v1/map/collections), không khai báo cứng tên collection.
 * Danh sách dưới đây CHỈ để kiểm chứng cơ chế vẽ MVT hoạt động đúng với một
 * Polygon và một Point trước — MỘT KHI xác nhận ổn, thay bằng registry thật
 * lấy từ API thay vì mảng tĩnh này (xem mục 9.1 trong tài liệu).
 */

export type MvtGeometryKind = 'polygon' | 'point';

export type MvtLayerConfig = {
  /** ID ổn định dùng cho UI/state, không phải tên collection. */
  id: string;
  /** Tên collection Directus — PHẢI khớp tuyệt đối source-layer trong MVT. */
  collection: string;
  /** Khóa i18n cho nhãn hiển thị. */
  labelKey: string;
  geometry: MvtGeometryKind;
  color: string;
  minzoom?: number;
  maxzoom?: number;
};

export const MVT_TILE_HOST = 'dcu.huecity.vn';

export function mvtTileUrl(collection: string): string {
  return `https://${MVT_TILE_HOST}/mvt/{z}/{x}/{y}.mvt?collections=${collection}`;
}

export const MVT_PROTOTYPE_LAYERS: MvtLayerConfig[] = [
  {
    id: 'thua-dat',
    collection: 'thua_dat',
    labelKey: 'mvt.thuaDat',
    geometry: 'polygon',
    color: '#0878bd',
    // Zoom đề nghị theo bảng 8.1 của tài liệu: "Polygon/line, zoom 12–22".
    minzoom: 12,
    maxzoom: 22,
  },
  {
    id: 'tram-bts',
    collection: 'trambts',
    labelKey: 'mvt.tramBts',
    geometry: 'point',
    color: '#f97316',
  },
];

export const mvtSourceId = (id: string) => `mvt-${id}-source`;
export const mvtFillLayerId = (id: string) => `mvt-${id}-fill`;
export const mvtOutlineLayerId = (id: string) => `mvt-${id}-outline`;
export const mvtCircleLayerId = (id: string) => `mvt-${id}-circle`;
