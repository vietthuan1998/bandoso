import { DCU_HOST_PATTERN, MAP_TILE_AUTH_HEADER, MAP_TILE_AUTH_HOST_PATTERN } from '@env';
import { directusTileToken } from '../api/directusAuth';

export type TileAuthRule = {
  id: string;
  hostPattern: string;
  headerName: string;
  headerValue: string;
};

/** Id mọi luật có thể có — để gỡ header của luật không còn áp dụng. */
export const TILE_AUTH_RULE_IDS = [
  'map-huecity-tile-auth',
  'dcu-huecity-auth',
] as const;

/**
 * Host tile dcu.huecity.vn trả 403 cho request không có Authorization. Token
 * chọn theo directusTileToken(): accessToken phiên đăng nhập khi host đã xác
 * nhận nhận nó, không thì token tĩnh API_ACCESS_TOKEN làm dự phòng (xem
 * services/api/directusAuth.ts). Token luôn đi trong header, không bao giờ
 * nằm trên query string (tài liệu mục 5, 11).
 */
export function getTileAuthRules(): TileAuthRule[] {
  const dcuToken = directusTileToken();
  return [
    MAP_TILE_AUTH_HOST_PATTERN && MAP_TILE_AUTH_HEADER
      ? {
          id: 'map-huecity-tile-auth',
          hostPattern: MAP_TILE_AUTH_HOST_PATTERN,
          headerName: 'Authorization',
          headerValue: MAP_TILE_AUTH_HEADER,
        }
      : null,
    DCU_HOST_PATTERN && dcuToken
      ? {
          id: 'dcu-huecity-auth',
          hostPattern: DCU_HOST_PATTERN,
          headerName: 'Authorization',
          headerValue: `Bearer ${dcuToken}`,
        }
      : null,
  ].filter((rule): rule is TileAuthRule => rule !== null);
}
