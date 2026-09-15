import axios from 'axios';
import { DCU_BEARER_TOKEN } from '@env';
import { TIMEOUT } from '../constants/url';
import { MVT_TILE_HOST } from './mvtLayers';

/**
 * Instance axios RIÊNG dùng chung cho mọi lệnh gọi Directus Items API trong
 * app (thay `axios` gốc) — CHỈ để gắn `timeout`, không dùng httpClient dùng
 * chung (lý do không dùng httpClient đã giải thích trong dataOverview.ts:
 * khác cơ chế xác thực). Trước đây KHÔNG có timeout nào cả — nếu 1 trong ~30
 * request mà màn hình Thống kê bắn song song (15 layer + 14 lớp lấy geom + 1
 * file ranh giới) bị treo (mất gói tin, server không phản hồi...), cả
 * Promise.all chứa nó sẽ chờ vô thời hạn, khiến "loading" không bao giờ tắt
 * dù mọi request khác đã xong — đúng hiện tượng đã gặp thật. Có timeout để
 * một request treo tự rớt thành lỗi (rồi bị try/catch trong từng hàm bắt,
 * coi là "không đọc được") thay vì treo cả màn hình.
 */
export const dcuAxios = axios.create({ timeout: TIMEOUT });

export function dcuHeaders() {
  return DCU_BEARER_TOKEN ? { Authorization: DCU_BEARER_TOKEN } : undefined;
}

export function dcuItemsUrl(collection: string): string {
  return `https://${MVT_TILE_HOST}/items/${collection}`;
}
