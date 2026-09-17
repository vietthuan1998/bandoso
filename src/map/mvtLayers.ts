export type MvtGeometryKind = 'polygon' | 'linestring' | 'point';
export type MvtGroupId = 'landData' | 'planning' | 'infrastructure' | 'iot';

export type MvtLayerConfig = {
  id: string;
  collection: string;
  labelKey: string;
  groupId: MvtGroupId;
  geometryTypes: MvtGeometryKind[];
  color: string;
  dashed?: boolean;
  minzoom?: number;
  maxzoom?: number;
};

export type MvtGroupConfig = {
  id: MvtGroupId;
  labelKey: string;
  color: string;
};

import { MVT_GROUPS, MVT_LAYERS, MVT_TILE_HOST } from '../data/mvtLayers';
export { MVT_GROUPS, MVT_LAYERS, MVT_TILE_HOST };

export function mvtTileUrl(collection: string): string {
  return `https://${MVT_TILE_HOST}/mvt/{z}/{x}/{y}.mvt?collections=${collection}`;
}

export const mvtSourceId = (id: string) => `mvt-${id}-source`;
export const mvtFillLayerId = (id: string) => `mvt-${id}-fill`;
export const mvtOutlineLayerId = (id: string) => `mvt-${id}-outline`;
export const mvtLineLayerId = (id: string) => `mvt-${id}-line`;
export const mvtCircleLayerId = (id: string) => `mvt-${id}-circle`;
