import axios from 'axios';
import { DCU_BEARER_TOKEN } from '@env';
import type { IconName } from '../components/HueMapScreen/Icon';
import { MVT_LAYERS, MVT_TILE_HOST } from './mvtLayers';

/**
 * CỐ Ý dùng `axios` gốc ở đây, KHÔNG dùng `httpClient` dùng chung
 * (src/api/httpClient.ts) — httpClient có interceptor tự gắn header
 * Authorization theo token đăng nhập của app (Bearer <token người dùng>),
 * sẽ GHI ĐÈ header Authorization ta tự đặt cho dcu.huecity.vn bên dưới,
 * khiến toàn bộ request gửi sai token và thất bại. dcu.huecity.vn dùng một
 * cơ chế xác thực hoàn toàn riêng (DCU_BEARER_TOKEN, không liên quan tài
 * khoản người dùng đăng nhập trong app) — giống cách MVT tile cũng xác thực
 * riêng qua TransformRequestManager (xem config/mapTileAuth.ts), không đi
 * qua httpClient/interceptor nào cả.
 */

/**
 * "Tổng quan dữ liệu" — đếm SỐ BẢN GHI THẬT trong từng collection Directus
 * (không phải số feature đã tải lên bản đồ, không phải số liệu tĩnh) bằng
 * API aggregate của Directus:
 *
 *   GET https://dcu.huecity.vn/items/<collection>?aggregate[count]=*
 *   → { "data": [{ "count": "<n>" }] }
 *
 * Đã kiểm chứng thực tế từng collection qua curl trước khi viết code này —
 * KHÔNG dùng limit=0 kèm aggregate (Directus trả data:[] rỗng, không có
 * count, nếu limit=0). Một số collection có thể trả lỗi quyền truy cập
 * (thực tế: "trambts" trả 403 FORBIDDEN với token hiện tại) — coi là collection
 * "không đọc được", không làm hỏng cả panel, chỉ trừ khỏi tổng và khỏi
 * tỉ lệ "đọc được".
 */

export type OverviewGroupConfig = {
  id: string;
  labelKey: string;
  icon: IconName;
  /** Tham chiếu tới MvtLayerConfig.id trong mvtLayers.ts, không phải tên collection Directus trực tiếp. */
  layerIds: string[];
};

// Dữ liệu cứng (cách nhóm 15 collection MVT thành 9 dòng hiển thị) đã
// chuyển sang src/data/dataOverviewGroups.ts — import lại rồi re-export ở
// đây để chỗ khác đang `import { DATA_OVERVIEW_GROUPS } from '.../dataOverview'`
// không phải sửa gì.
import { DATA_OVERVIEW_GROUPS } from '../data/dataOverviewGroups';
export { DATA_OVERVIEW_GROUPS };

export type DataOverviewGroupResult = {
  id: string;
  labelKey: string;
  icon: IconName;
  /** Tổng đếm được của các collection ĐỌC ĐƯỢC trong nhóm; null nếu cả nhóm không đọc được collection nào. */
  count: number | null;
};

export type DataOverview = {
  /** Tổng số đối tượng cộng dồn từ mọi collection đọc được (không tính collection lỗi quyền truy cập). */
  totalObjects: number;
  /** Số collection đọc được thành công. */
  readableCollections: number;
  /** Tổng số collection đã thử (bằng số phần tử MVT_LAYERS). */
  totalCollections: number;
  groups: DataOverviewGroupResult[];
};

async function fetchCollectionCount(
  collection: string,
): Promise<number | null> {
  try {
    const response = await axios.get<{ data: Array<{ count: string }> }>(
      `https://${MVT_TILE_HOST}/items/${collection}`,
      {
        params: { 'aggregate[count]': '*' },
        headers: DCU_BEARER_TOKEN
          ? { Authorization: DCU_BEARER_TOKEN }
          : undefined,
      },
    );
    const raw = response.data.data?.[0]?.count;
    const count = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(count) ? count : null;
  } catch {
    // Collection có thể trả lỗi quyền truy cập (thực tế: trambts → 403) hoặc
    // lỗi mạng — coi là "không đọc được", không ném lỗi làm hỏng cả panel.
    return null;
  }
}

export async function fetchDataOverview(): Promise<DataOverview> {
  const countByLayerId = new Map<string, number | null>();

  await Promise.all(
    MVT_LAYERS.map(async layer => {
      countByLayerId.set(layer.id, await fetchCollectionCount(layer.collection));
    }),
  );

  let totalObjects = 0;
  let readableCollections = 0;
  for (const count of countByLayerId.values()) {
    if (count !== null) {
      totalObjects += count;
      readableCollections += 1;
    }
  }

  const groups: DataOverviewGroupResult[] = DATA_OVERVIEW_GROUPS.map(
    group => {
      const counts = group.layerIds.map(id => countByLayerId.get(id) ?? null);
      const readable = counts.filter(
        (count): count is number => count !== null,
      );
      return {
        id: group.id,
        labelKey: group.labelKey,
        icon: group.icon,
        count: readable.length
          ? readable.reduce((sum, count) => sum + count, 0)
          : null,
      };
    },
  );

  return {
    totalObjects,
    readableCollections,
    totalCollections: MVT_LAYERS.length,
    groups,
  };
}
