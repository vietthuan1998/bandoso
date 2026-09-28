import { dcuAxios, dcuHeaders, dcuItemsUrl } from '../api/dcuClient';
import type { MvtLayerConfig } from '../map/mvtLayers';

/**
 * Tiện ích dữ liệu dùng chung cho màn Dữ liệu và biểu đồ. Số liệu thống kê
 * chính thức lấy từ API /statistics/* (statisticsApi.ts) — không tự tính ở đây.
 */

export function isSystemDirectusCollection(name: string): boolean {
  return name.startsWith('directus_');
}

export function layerHasDateField(layer: MvtLayerConfig): boolean {
  return layer.updatedAtField !== null;
}

export type TrendPoint = { date: string; label: string; count: number };

const WARD_COLLECTION = 'thua_dat';
const WARD_GROUP_FIELD = 'ten_xa';

export type WardBreakdownItem = {
  ward: string;
  fullName: string;
  count: number;
};

function formatWardShortName(tenXa: string): string {
  return tenXa.replace(/^(Phường|Xã|Thị trấn)\s+/i, '');
}

/** Danh sách phường xã có trong thửa đất (lọc màn Dữ liệu theo ten_xa). */
export async function fetchWardDirectory(): Promise<WardBreakdownItem[]> {
  try {
    const response = await dcuAxios.get<{
      data: Array<{ [WARD_GROUP_FIELD]: string; count: string }>;
    }>(dcuItemsUrl(WARD_COLLECTION), {
      params: {
        'aggregate[count]': '*',
        'groupBy[]': WARD_GROUP_FIELD,
        'sort[]': '-count',
      },
      headers: dcuHeaders(),
    });

    const items: WardBreakdownItem[] = [];
    for (const row of response.data.data ?? []) {
      const name = (row[WARD_GROUP_FIELD] ?? '').trim();
      if (!name) continue;
      items.push({
        ward: formatWardShortName(name),
        fullName: name,
        count: Number(row.count) || 0,
      });
    }
    return items.sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export function extractRepresentativePoint(
  geom: { type: string; coordinates: unknown } | null | undefined,
): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Point') {
    const c = geom.coordinates as number[];
    return Number.isFinite(c?.[0]) && Number.isFinite(c?.[1])
      ? [c[0], c[1]]
      : null;
  }
  const ring: number[][] | undefined =
    geom.type === 'Polygon'
      ? (geom.coordinates as number[][][])[0]
      : geom.type === 'MultiPolygon'
      ? (geom.coordinates as number[][][][])[0]?.[0]
      : undefined;
  if (!ring?.length) return null;
  const xs = ring.map(p => p[0]);
  const ys = ring.map(p => p[1]);
  return [
    xs.reduce((a, b) => a + b, 0) / xs.length,
    ys.reduce((a, b) => a + b, 0) / ys.length,
  ];
}
