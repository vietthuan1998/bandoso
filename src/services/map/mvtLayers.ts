import type { IconName } from '../../components/common/Icon';
import { DIRECTUS_BASE_URL } from '../../constants/url';

export type MvtGeometryKind = 'polygon' | 'linestring' | 'point';

/**
 * Một lớp MVT đã chuẩn hoá từ registry GET /map/layers (services/map/mapRegistry.ts).
 * Registry là nguồn duy nhất cho danh sách lớp — không hard-code lớp ở client.
 */
export type MvtLayerConfig = {
  /** = collectionKey của registry, dùng làm khoá ổn định trong app. */
  id: string;
  /** Collection Directus để đọc items/aggregate. */
  collection: string;
  sourceLayer: string;
  tileUrl: string;
  label: string;
  /** = menuGroup của registry, khớp key của /catalog/layer-groups. */
  groupKey: string;
  geometryTypes: MvtGeometryKind[];
  color: string;
  icon: IconName;
  minzoom?: number;
  maxzoom?: number;
  /** Trường ngày cập nhật (dimensions.updatedAtField), null nếu lớp không theo dõi. */
  updatedAtField: string | null;
  /** Trường số được phép gửi cho /statistics/{key}/measures (dimensions.measureFields). */
  measureFields: string[];
  /** Khoá của feature trong tile (9 lớp gisportal_* dùng "objectid", không phải "id"). */
  featureIdField: string;
  /** Khoá bản ghi trong Directus (items/{collection}/{id}). */
  directusIdField: string;
  /** Trường hình học của bản ghi Directus. */
  geometryField: string;
  /** Tiêu đề = giá trị khác rỗng đầu tiên theo thứ tự các trường này. */
  titleFields: string[];
  /** Trường đưa vào ô tìm kiếm. */
  searchableFields: string[];
  /** Cột hiển thị trong danh sách. */
  listFields: string[];
  /** Thứ tự + danh sách trường của panel chi tiết. */
  detailFields: string[];
  /** Trường không bao giờ được hiển thị (hình học, id, trường hệ thống...). */
  hiddenFields: string[];
  /** Tên trường -> nhãn tiếng Việt. */
  fieldLabels: Record<string, string>;
  /** Tên trường -> (mã giá trị -> nhãn), vd. linh_vuc "BDS" -> "Bất động sản". */
  valueLabels: Record<string, Record<string, string>>;
  /** Trường có giá trị là object -> khoá con cần hiển thị, vd. water_station_type -> "desc". */
  objectValueKeys: Record<string, string>;
  capabilities: {
    list: boolean;
    detail: boolean;
    search: boolean;
    statistics: boolean;
  };
};

export type MvtGroupConfig = {
  key: string;
  label: string;
  icon: IconName;
};

export const mvtSourceId = (id: string) => `mvt-${id}-source`;
export const mvtFillLayerId = (id: string) => `mvt-${id}-fill`;
export const mvtOutlineLayerId = (id: string) => `mvt-${id}-outline`;
export const mvtLineLayerId = (id: string) => `mvt-${id}-line`;
export const mvtCircleLayerId = (id: string) => `mvt-${id}-circle`;

const DIRECT_TILE_URL_RE = /^https?:\/\/[^/]+(\/mvt\/.*)$/;

/**
 * Registry trả tileUrl trỏ thẳng host Directus (vd. https://dcu.huecity.vn
 * /mvt/{z}/{x}/{y}.mvt?collections=bts). Tile phải đi qua proxy BFF (tài liệu
 * mục 5): chỉ thay phần origin bằng DIRECTUS_BASE_URL, giữ nguyên đường dẫn
 * và query của registry — không tự ghép URL. tileUrl không có dạng /mvt/...
 * ở gốc host (vd. đã trỏ sẵn về proxy) thì giữ nguyên.
 */
export function proxiedTileUrl(tileUrl: string): string {
  const match = DIRECT_TILE_URL_RE.exec(tileUrl);
  return match ? `${DIRECTUS_BASE_URL}${match[1]}` : tileUrl;
}
