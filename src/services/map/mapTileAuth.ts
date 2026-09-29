import { MAP_TILE_AUTH_HEADER, MAP_TILE_AUTH_HOST_PATTERN } from '@env';

export type TileAuthRule = {
  id: string;
  hostPattern: string;
  headerName: string;
  headerValue: string;
};

/**
 * Id mọi luật từng có — để gỡ header của luật không còn áp dụng.
 * 'dcu-huecity-auth' đã bỏ (tile Directus đi qua proxy BFF, xem
 * proxiedTileUrl) nhưng vẫn giữ id để gỡ header cũ nếu còn đăng ký.
 */
export const TILE_AUTH_RULE_IDS = [
  'map-huecity-tile-auth',
  'dcu-huecity-auth',
] as const;

/**
 * Header xác thực cho request tải bản đồ. Tile lớp dữ liệu đi qua proxy BFF
 * (BASE_URL/directus/mvt) — server tự gắn xác thực, client không giữ token
 * (tài liệu mục 5). Chỉ còn luật Basic cho style/tile bản đồ nền
 * map.huecity.vn:8280.
 */
export function getTileAuthRules(): TileAuthRule[] {
  return MAP_TILE_AUTH_HOST_PATTERN && MAP_TILE_AUTH_HEADER
    ? [
        {
          id: 'map-huecity-tile-auth',
          hostPattern: MAP_TILE_AUTH_HOST_PATTERN,
          headerName: 'Authorization',
          headerValue: MAP_TILE_AUTH_HEADER,
        },
      ]
    : [];
}
