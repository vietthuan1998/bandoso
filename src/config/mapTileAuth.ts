import {
  DCU_BEARER_TOKEN,
  DCU_HOST_PATTERN,
  MAP_TILE_AUTH_HEADER,
  MAP_TILE_AUTH_HOST_PATTERN,
} from '@env';

export type TileAuthRule = {
  id: string;
  /** Chuỗi regex khớp URL (đã escape dấu chấm), truyền thẳng cho TransformRequestManager.addHeader({ match }). */
  hostPattern: string;
  headerName: string;
  headerValue: string;
};

/**
 * Mỗi rule tương ứng một host cần đính kèm header xác thực khi tải style/tile
 * bản đồ — bản web dùng if/else "startsWith" cứng trong transformRequest,
 * bản mobile tổng quát hoá thành danh sách để dễ thêm host mới mà không sửa
 * logic gọi TransformRequestManager.
 *
 * Giá trị thật (host pattern + token) nằm trong file .env, không commit —
 * xem .env.example để biết các biến cần khai báo. Thiếu biến nào thì rule đó
 * bị bỏ qua thay vì gửi header rỗng/"Bearer undefined".
 */
export const TILE_AUTH_RULES: TileAuthRule[] = [
  MAP_TILE_AUTH_HOST_PATTERN && MAP_TILE_AUTH_HEADER
    ? {
        id: 'map-huecity-tile-auth',
        hostPattern: MAP_TILE_AUTH_HOST_PATTERN,
        headerName: 'Authorization',
        headerValue: MAP_TILE_AUTH_HEADER,
      }
    : null,
  DCU_HOST_PATTERN && DCU_BEARER_TOKEN
    ? {
        id: 'dcu-huecity-auth',
        hostPattern: DCU_HOST_PATTERN,
        headerName: 'Authorization',
        headerValue: DCU_BEARER_TOKEN,
      }
    : null,
].filter((rule): rule is TileAuthRule => rule !== null);
