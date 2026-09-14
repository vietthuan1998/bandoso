/**
 * Vẽ MVT (Mapbox Vector Tile) theo mục 8 và 10.1 của ĐẶC TẢ KỸ THUẬT HỆ THỐNG
 * (mota/MO_TA_KY_THUAT_...docx):
 *
 *   "Toàn bộ lớp nghiệp vụ trong phạm vi phải được vẽ từ:
 *    https://dcu.huecity.vn/mvt/{z}/{x}/{y}.mvt?collections=${collection}"
 *
 * File này giữ TYPE và các hàm build id/url của MVT layer. Dữ liệu cứng
 * (MVT_GROUPS, MVT_TILE_HOST, MVT_LAYERS) đã chuyển sang src/data/mvtLayers.ts
 * — import lại rồi re-export ở đây để mọi nơi đang
 * `import { MVT_LAYERS } from '.../map/mvtLayers'` không phải sửa gì.
 */

export type MvtGeometryKind = 'polygon' | 'linestring' | 'point';
export type MvtGroupId = 'landData' | 'planning' | 'infrastructure' | 'iot';

export type MvtLayerConfig = {
  /** ID ổn định dùng cho UI/state, không phải tên collection. */
  id: string;
  /** Tên collection Directus — PHẢI khớp tuyệt đối source-layer trong MVT. */
  collection: string;
  /** Khóa i18n cho nhãn hiển thị. */
  labelKey: string;
  groupId: MvtGroupId;
  /**
   * Các kiểu hình học có thể xuất hiện trong collection này. Dùng mảng vì
   * một collection có thể trộn nhiều kiểu (mục 9, bảng 8.1); mỗi kiểu được
   * lọc bằng biểu thức ['==', ['geometry-type'], ...] khi vẽ (mục 10.1).
   */
  geometryTypes: MvtGeometryKind[];
  color: string;
  /**
   * true cho lớp "định hướng" (quy hoạch/tương lai) — vẽ viền nét đứt và fill
   * nhạt hơn để phân biệt trực quan với lớp "hiện trạng" (nét liền) cùng chủ
   * đề, theo quy ước bản đồ quy hoạch thông thường.
   */
  dashed?: boolean;
  minzoom?: number;
  maxzoom?: number;
};

export type MvtGroupConfig = {
  id: MvtGroupId;
  labelKey: string;
  color: string;
};

import { MVT_GROUPS, MVT_LAYERS, MVT_TILE_HOST } from '../data/mvtLayers';
export { MVT_GROUPS, MVT_LAYERS, MVT_TILE_HOST };

export function mvtTileUrl(collection: string): string {
  return `https://${MVT_TILE_HOST}/mvt/{z}/{x}/{y}.mvt?collections=${collection}`;
}

export const mvtSourceId = (id: string) => `mvt-${id}-source`;
export const mvtFillLayerId = (id: string) => `mvt-${id}-fill`;
export const mvtOutlineLayerId = (id: string) => `mvt-${id}-outline`;
export const mvtLineLayerId = (id: string) => `mvt-${id}-line`;
export const mvtCircleLayerId = (id: string) => `mvt-${id}-circle`;
