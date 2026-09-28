import { DCU_HOST_PATTERN, MAP_TILE_AUTH_HEADER, MAP_TILE_AUTH_HOST_PATTERN } from '@env';
import { getStaticApiToken } from '../../config/apiAccessToken';
import { getAccessToken } from '../auth/authClient';

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
 * dùng: token phiên đăng nhập, nếu chưa đăng nhập thì token tĩnh
 * API_ACCESS_TOKEN trong .env (xem config/apiAccessToken.ts); không có cả hai
 * thì không có luật -> tile bị 403.
 *
 * Đọc lại mỗi lần gọi (không phải mảng tĩnh tính một lần khi load module) —
 * accessToken đổi theo phiên đăng nhập/refresh, không còn là secret tĩnh
 * DCU_BEARER_TOKEN nữa. Gọi lại hàm này (và đăng ký lại qua
 * TransformRequestManager.addHeader — addHeader cập nhật in-place theo id)
 * sau mỗi lần đăng nhập/refresh thành công.
 */
export function getTileAuthRules(): TileAuthRule[] {
  const accessToken = getAccessToken() ?? getStaticApiToken();
  return [
    MAP_TILE_AUTH_HOST_PATTERN && MAP_TILE_AUTH_HEADER
      ? {
          id: 'map-huecity-tile-auth',
          hostPattern: MAP_TILE_AUTH_HOST_PATTERN,
          headerName: 'Authorization',
          headerValue: MAP_TILE_AUTH_HEADER,
        }
      : null,
    DCU_HOST_PATTERN && accessToken
      ? {
          id: 'dcu-huecity-auth',
          hostPattern: DCU_HOST_PATTERN,
          headerName: 'Authorization',
          headerValue: `Bearer ${accessToken}`,
        }
      : null,
  ].filter((rule): rule is TileAuthRule => rule !== null);
}
