import {
  DCU_BEARER_TOKEN,
  DCU_HOST_PATTERN,
  MAP_TILE_AUTH_HEADER,
  MAP_TILE_AUTH_HOST_PATTERN,
} from '@env';

export type TileAuthRule = {
  id: string;
  hostPattern: string;
  headerName: string;
  headerValue: string;
};

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
