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
