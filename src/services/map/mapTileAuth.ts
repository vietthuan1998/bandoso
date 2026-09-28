import { DCU_HOST_PATTERN, MAP_TILE_AUTH_HEADER, MAP_TILE_AUTH_HOST_PATTERN } from '@env';
import { getStaticApiToken } from '../../config/apiAccessToken';

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
 * Host tile dcu.huecity.vn trả 403 cho request không có Authorization và 401
 * cho token nó không nhận ra — kể cả accessToken phiên đăng nhập BFF
 * (dcudata.cgb.vn), vì hai hệ thống xác thực tách rời. Nên tile luôn dùng
 * token tĩnh API_ACCESS_TOKEN trong .env (xem config/apiAccessToken.ts),
 * dù đã đăng nhập hay chưa; không có token tĩnh thì không có luật -> 403.
 */
export function getTileAuthRules(): TileAuthRule[] {
  const staticToken = getStaticApiToken();
  return [
    MAP_TILE_AUTH_HOST_PATTERN && MAP_TILE_AUTH_HEADER
      ? {
          id: 'map-huecity-tile-auth',
          hostPattern: MAP_TILE_AUTH_HOST_PATTERN,
          headerName: 'Authorization',
          headerValue: MAP_TILE_AUTH_HEADER,
        }
      : null,
    DCU_HOST_PATTERN && staticToken
      ? {
          id: 'dcu-huecity-auth',
          hostPattern: DCU_HOST_PATTERN,
          headerName: 'Authorization',
          headerValue: `Bearer ${staticToken}`,
        }
      : null,
  ].filter((rule): rule is TileAuthRule => rule !== null);
}
