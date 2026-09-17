export type GeoJsonGeometry =
  | { type: string; coordinates: unknown }
  | null
  | undefined;

function collectPoints(coordinates: unknown, into: number[][]): void {
  if (!Array.isArray(coordinates)) return;
  const [a, b] = coordinates;
  if (typeof a === 'number' && typeof b === 'number') {
    into.push([a, b]);
    return;
  }
  for (const item of coordinates) collectPoints(item, into);
}

export function boundsOfGeometry(
  geometry: GeoJsonGeometry,
): [number, number, number, number] | null {
  if (!geometry) return null;
  const points: number[][] = [];
  collectPoints(geometry.coordinates, points);
  if (!points.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}
