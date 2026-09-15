import { dcuAxios, dcuHeaders, dcuItemsUrl } from './dcuClient';
import { pad2 } from './normalizeFeatureFields';
import type { TrendPoint } from './statisticsOverview';

/**
 * Chuỗi thời gian THẬT cho 3 loại trạm IoT có bảng "số đo" (depth/tốc độ
 * gió) riêng trong Directus, phát hiện được qua GET /fields/<collection>:
 *
 *   rain_water_stations  --(code == station_id)--> rain_water_depth  {station_id, depth, time_point}
 *   water_level_station  --(code == station_id)--> water_level_depth {station_id, depth, time_point}
 *   iot_wind_station     --(id   == sid)-------->   iot_wind_speed   {sid, ws, time_point}
 *
 * (Đã kiểm chứng bằng dữ liệu thật: station_id "750041" của rain_water_depth
 * khớp code trạm mưa "TRẠM ĐO MƯA BÌNH ĐIỀN" trong mota/5.jpg; sid của
 * iot_wind_speed khớp id (uuid) của iot_wind_station.)
 *
 * BTS (tram-bts) KHÔNG có bảng số đo tương ứng nào — dù cùng nhóm "IoT" theo
 * MVT_GROUPS, KHÔNG coi là "trạm IoT có biểu đồ" ở đây; FeatureDetailScreen
 * dựa vào iotParameterForLayer() (trả về null cho BTS) để quyết định hiện
 * biểu đồ, KHÔNG dựa vào groupId — tránh vẽ biểu đồ cho lớp không có dữ liệu
 * chuỗi thời gian thật.
 */

export type IotParameterKind = 'rain' | 'waterLevel' | 'wind';

type IotFieldName = 'depth' | 'ws' | 'wsg';

type IotParamConfig = {
  collection: string;
  /** Field trong bảng số đo dùng để lọc theo trạm. */
  filterField: 'station_id' | 'sid';
  /** Field trong properties của trạm (MVT) khớp với filterField ở trên. */
  stationField: 'code' | 'id';
  /** Field dùng cho "Hiện tại" + biểu đồ 24 giờ (trung bình mỗi giờ). */
  valueField: IotFieldName;
  /** Field dùng riêng để tính "Đỉnh 24 giờ" — mặc định giống valueField;
   * riêng gió dùng "wsg" (gió GIẬT) thay vì "ws" (tốc độ gió trung bình) vì
   * theo quy ước khí tượng, "đỉnh" của gió luôn tính theo gió giật, không
   * phải tốc độ tức thời cao nhất. */
  aggregateValueField: IotFieldName;
  unit: string;
  /** "sum" cho lượng mưa (cộng dồn từng mốc đo) — "max" cho mực nước/gió
   * (đại lượng tức thời, lấy đỉnh trong 24h thay vì cộng dồn vô nghĩa). */
  aggregateKind: 'sum' | 'max';
};

const IOT_PARAM_CONFIG: Record<IotParameterKind, IotParamConfig> = {
  rain: {
    collection: 'rain_water_depth',
    filterField: 'station_id',
    stationField: 'code',
    valueField: 'depth',
    aggregateValueField: 'depth',
    unit: 'mm',
    aggregateKind: 'sum',
  },
  waterLevel: {
    collection: 'water_level_depth',
    filterField: 'station_id',
    stationField: 'code',
    valueField: 'depth',
    aggregateValueField: 'depth',
    unit: 'm',
    aggregateKind: 'max',
  },
  wind: {
    collection: 'iot_wind_speed',
    filterField: 'sid',
    stationField: 'id',
    valueField: 'ws',
    aggregateValueField: 'wsg',
    unit: 'm/s',
    aggregateKind: 'max',
  },
};

/** Lớp MVT nào có bảng số đo chuỗi thời gian thật đứng sau nó — chỉ 3 id này. */
export function iotParameterForLayer(layerId: string): IotParameterKind | null {
  switch (layerId) {
    case 'rain-water-stations':
      return 'rain';
    case 'water-level-station':
      return 'waterLevel';
    case 'iot-wind-station':
      return 'wind';
    default:
      return null;
  }
}

/** Giá trị định danh trạm lấy thẳng từ properties của feature đang xem —
 * dùng để lọc bảng số đo (xem bảng khớp field ở đầu file). null nếu tile
 * thiếu field này (không nên xảy ra với 3 collection đã xác nhận). */
export function iotStationIdentifier(
  kind: IotParameterKind,
  properties: Record<string, unknown>,
): string | null {
  const value = properties[IOT_PARAM_CONFIG[kind].stationField];
  return value !== null && value !== undefined && String(value).trim()
    ? String(value).trim()
    : null;
}

export type IotStationDetail = {
  unit: string;
  aggregateKind: 'sum' | 'max';
  currentValue: number | null;
  currentAt: string | null;
  aggregateValue: number | null;
  /** Tổng số mốc đo thật đọc được trong 24 giờ qua (không phải số đã suy
   * ra/nội suy) — hiện ở ô tile thứ 3 thay cho "Cảnh báo" (không có ngưỡng
   * cảnh báo thật nào được cấu hình nên không tự đặt ra). */
  readingCount: number;
  /** 24 điểm/giờ, dàn đều 24 giờ qua tới giờ hiện tại — rỗng nếu không có
   * mốc đo thật nào trong khoảng này. Dùng cho TrendChart. */
  chartPoints: TrendPoint[];
};

/**
 * Tải toàn bộ mốc đo THẬT trong 24 giờ qua của 1 trạm cụ thể rồi gộp theo
 * từng giờ (label "HH:00", giờ kết thúc của khung giờ đó) để vẽ lại bằng
 * TrendChart (dùng chung với "Xu hướng cập nhật" của StatisticsScreen, xem
 * ghi chú tại đó) — KHÔNG có API tổng hợp theo giờ nên phải tự gộp trên
 * client từ dữ liệu thô.
 *
 * "24 giờ qua" tính MỐC KẾT THÚC theo MỐC ĐO MỚI NHẤT THẬT của chính trạm
 * (query phụ lấy 1 bản ghi mới nhất trước), KHÔNG dùng giờ hiện tại của máy
 * — đã kiểm chứng bằng dữ liệu thật: bảng iot_wind_speed hiện trễ >32 giờ so
 * với đồng hồ hệ thống (bản ghi mới nhất toàn bộ bảng là 2026-09-13T01:30,
 * trong khi rain_water_depth/water_level_depth cập nhật gần như tức thời).
 * Nếu lọc theo "now - 24h" thì MỌI trạm gió sẽ luôn ra rỗng dù dữ liệu vẫn
 * tồn tại — dùng mốc đo mới nhất của trạm làm neo để "24 giờ qua" luôn có
 * nghĩa với dữ liệu thật đang có, không phụ thuộc độ trễ nạp dữ liệu của
 * từng nguồn.
 *
 * Giờ nào không có mốc đo nào: lượng mưa (sum) coi là 0 (đúng nghĩa "không
 * mưa"); mực nước/gió (max) giữ nguyên giá trị đo gần nhất trước đó (không
 * bịa số 0 giả cho một đại lượng tức thời) — chỉ để trống nếu chưa có mốc đo
 * thật nào trước đó trong toàn bộ khoảng 24h.
 *
 * "Đỉnh 24 giờ" tính riêng theo `aggregateValueField` (khác `valueField` với
 * gió — xem IOT_PARAM_CONFIG), KHÔNG dùng chung dữ liệu với "Hiện tại"/biểu
 * đồ — nên khi 2 field khác nhau, tải thêm cả 2 cột trong cùng 1 truy vấn
 * thay vì gọi API lần nữa.
 */
export async function fetchIotStationDetail(
  kind: IotParameterKind,
  stationValue: string,
): Promise<IotStationDetail | null> {
  const config = IOT_PARAM_CONFIG[kind];
  const sameAggregateField = config.aggregateValueField === config.valueField;
  try {
    // Query phụ: chỉ lấy đúng 1 bản ghi mới nhất để biết mốc "hiện tại" THẬT
    // của trạm này — rẻ (limit 1), tránh phải đoán độ trễ nạp dữ liệu.
    const latestResponse = await dcuAxios.get<{
      data: Array<{ time_point: string }>;
    }>(dcuItemsUrl(config.collection), {
      params: {
        [`filter[${config.filterField}][_eq]`]: stationValue,
        'sort[]': '-time_point',
        fields: 'time_point',
        limit: 1,
      },
      headers: dcuHeaders(),
    });
    const latestIso = latestResponse.data.data?.[0]?.time_point ?? null;
    const anchor = latestIso ? new Date(latestIso) : null;
    if (!anchor || Number.isNaN(anchor.getTime())) {
      // Trạm chưa từng có mốc đo nào — không phải lỗi, chỉ là chưa có dữ
      // liệu, coi như "24 giờ qua" trống thay vì báo lỗi đọc.
      return {
        unit: config.unit,
        aggregateKind: config.aggregateKind,
        currentValue: null,
        currentAt: null,
        aggregateValue: null,
        readingCount: 0,
        chartPoints: [],
      };
    }
    const since = new Date(anchor.getTime() - 24 * 3_600_000);

    const response = await dcuAxios.get<{
      data: Array<{ time_point: string; [key: string]: unknown }>;
    }>(dcuItemsUrl(config.collection), {
      params: {
        [`filter[${config.filterField}][_eq]`]: stationValue,
        [`filter[time_point][_gte]`]: since.toISOString(),
        'sort[]': 'time_point',
        fields: sameAggregateField
          ? `time_point,${config.valueField}`
          : `time_point,${config.valueField},${config.aggregateValueField}`,
        limit: -1,
      },
      headers: dcuHeaders(),
    });

    const rows = (response.data.data ?? [])
      .map(row => ({
        time: new Date(row.time_point),
        value: Number(row[config.valueField]),
        aggregateValue: Number(row[config.aggregateValueField]),
      }))
      .filter(
        row => !Number.isNaN(row.time.getTime()) && Number.isFinite(row.value),
      );

    const current = rows.length ? rows[rows.length - 1] : null;
    // Chỉ tính trên các bản ghi có giá trị hợp lệ ở CHÍNH field tổng hợp
    // (vd. "wsg" có thể null/lỗi ở 1 số bản ghi dù "ws" vẫn hợp lệ).
    const aggregateRows = rows.filter(row => Number.isFinite(row.aggregateValue));
    const aggregateValue = aggregateRows.length
      ? config.aggregateKind === 'sum'
        ? aggregateRows.reduce((sum, row) => sum + row.aggregateValue, 0)
        : Math.max(...aggregateRows.map(row => row.aggregateValue))
      : null;

    // Gộp 24 khung giờ, mỗi khung kết thúc đúng giờ tròn — khung cuối cùng
    // kết thúc ở giờ tròn KẾ TIẾP mốc đo mới nhất của trạm (vd. mốc mới nhất
    // là 09:25 -> khung cuối kết thúc 10:00), KHÔNG phải giờ hiện tại của
    // máy (xem giải thích "anchor" ở đầu hàm) — để mốc đo mới nhất luôn rơi
    // vào khung nào đó dù dữ liệu trạm có trễ tới đâu.
    const windowEnd = new Date(anchor);
    windowEnd.setMinutes(0, 0, 0);
    windowEnd.setHours(windowEnd.getHours() + 1);

    let lastKnown: number | null = null;
    const chartPoints: TrendPoint[] = [];
    for (let i = 23; i >= 0; i--) {
      const bucketEnd = new Date(windowEnd.getTime() - i * 3_600_000);
      const bucketStart = new Date(bucketEnd.getTime() - 3_600_000);
      const inBucket = rows.filter(
        row => row.time >= bucketStart && row.time < bucketEnd,
      );
      let value: number;
      if (inBucket.length) {
        value =
          config.aggregateKind === 'sum'
            ? inBucket.reduce((sum, row) => sum + row.value, 0)
            : inBucket.reduce((sum, row) => sum + row.value, 0) /
              inBucket.length;
        lastKnown = value;
      } else {
        value = config.aggregateKind === 'sum' ? 0 : lastKnown ?? 0;
      }
      chartPoints.push({
        date: bucketEnd.toISOString(),
        label: `${pad2(bucketEnd.getHours())}:00`,
        count: value,
      });
    }

    return {
      unit: config.unit,
      aggregateKind: config.aggregateKind,
      currentValue: current?.value ?? null,
      currentAt: current ? current.time.toISOString() : null,
      aggregateValue,
      readingCount: rows.length,
      chartPoints: rows.length ? chartPoints : [],
    };
  } catch {
    return null;
  }
}

/** 1 bản ghi THÔ (chưa gộp giờ) dùng cho bảng "Lịch sử dữ liệu" phân trang —
 * khác chartPoints (24 điểm/giờ, cố định trong 24h qua), bảng này đi lùi
 * VÔ HẠN về quá khứ theo yêu cầu người dùng (load more khi cuộn gần cuối),
 * nên phải hiển thị đúng mốc đo gốc thay vì gộp theo giờ — gộp sẽ cần biết
 * trước sẽ tải bao xa để chọn kích thước khung giờ, không hợp với phân
 * trang mở. */
export type IotHistoryRecord = {
  id: number;
  /** ISO timestamp — mốc đo gốc, CHƯA làm tròn giờ. */
  time: string;
  value: number;
};

export type IotHistoryPage = {
  items: IotHistoryRecord[];
  /** Truyền lại nguyên văn vào `before` của lần gọi kế tiếp để lấy trang cũ
   * hơn — null nghĩa là đã hết dữ liệu (trang này ngắn hơn `limit`). */
  nextCursor: string | null;
};

/**
 * Tải 1 trang "Lịch sử dữ liệu" của 1 trạm, MỚI NHẤT TRƯỚC, phân trang bằng
 * con trỏ thời gian (`filter[time_point][_lt]=before`) thay vì offset — đúng
 * kiểu dữ liệu chuỗi thời gian liên tục nạp thêm bản ghi mới mỗi vài phút:
 * offset sẽ lệch dần khi có bản ghi mới chèn vào giữa lúc đang cuộn, còn
 * cursor theo thời gian luôn ổn định vì mốc `before` cố định.
 *
 * Không giới hạn 24 giờ như fetchIotStationDetail (dùng cho tile/biểu đồ
 * "snapshot" gần nhất) — hàm này phục vụ xem SÂU về quá khứ, gọi lại nhiều
 * lần theo thao tác cuộn (xem FeatureDetailScreen).
 */
export async function fetchIotHistoryPage(
  kind: IotParameterKind,
  stationValue: string,
  options: { before?: string | null; limit?: number } = {},
): Promise<IotHistoryPage> {
  const config = IOT_PARAM_CONFIG[kind];
  const limit = options.limit ?? 20;
  try {
    const params: Record<string, string | number> = {
      [`filter[${config.filterField}][_eq]`]: stationValue,
      'sort[]': '-time_point',
      fields: `id,time_point,${config.valueField}`,
      limit,
    };
    if (options.before) {
      params[`filter[time_point][_lt]`] = options.before;
    }
    const response = await dcuAxios.get<{
      data: Array<{ id: number; time_point: string; [key: string]: unknown }>;
    }>(dcuItemsUrl(config.collection), { params, headers: dcuHeaders() });

    const items = (response.data.data ?? [])
      .map(row => ({
        id: row.id,
        time: row.time_point,
        value: Number(row[config.valueField]),
      }))
      .filter(row => Number.isFinite(row.value));

    // Còn đủ `limit` bản ghi -> có thể còn trang cũ hơn; ít hơn -> đã chạm
    // đáy dữ liệu thật của trạm, không cần đoán/tải thử trang kế tiếp.
    const nextCursor =
      items.length === limit ? items[items.length - 1].time : null;

    return { items, nextCursor };
  } catch {
    return { items: [], nextCursor: null };
  }
}
