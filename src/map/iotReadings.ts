import { dcuAxios, dcuHeaders, dcuItemsUrl } from './dcuClient';
import { pad2 } from './normalizeFeatureFields';
import type { TrendPoint } from './statisticsOverview';

export type IotParameterKind = 'rain' | 'waterLevel' | 'wind';

type IotFieldName = 'depth' | 'ws' | 'wsg';

type IotParamConfig = {
  collection: string;
  filterField: 'station_id' | 'sid';
  stationField: 'code' | 'id';
  valueField: IotFieldName;
  aggregateValueField: IotFieldName;
  unit: string;
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
  readingCount: number;
  chartPoints: TrendPoint[];
};

export async function fetchIotStationDetail(
  kind: IotParameterKind,
  stationValue: string,
): Promise<IotStationDetail | null> {
  const config = IOT_PARAM_CONFIG[kind];
  const sameAggregateField = config.aggregateValueField === config.valueField;
  try {
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
    const aggregateRows = rows.filter(row =>
      Number.isFinite(row.aggregateValue),
    );
    const aggregateValue = aggregateRows.length
      ? config.aggregateKind === 'sum'
        ? aggregateRows.reduce((sum, row) => sum + row.aggregateValue, 0)
        : Math.max(...aggregateRows.map(row => row.aggregateValue))
      : null;

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

export type IotHistoryRecord = {
  id: number;
  time: string;
  value: number;
};

export type IotHistoryPage = {
  items: IotHistoryRecord[];
  nextCursor: string | null;
};

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

    const nextCursor =
      items.length === limit ? items[items.length - 1].time : null;

    return { items, nextCursor };
  } catch {
    return { items: [], nextCursor: null };
  }
}
