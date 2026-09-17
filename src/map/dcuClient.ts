import axios from 'axios';
import { DCU_BEARER_TOKEN } from '@env';
import { TIMEOUT } from '../constants/url';
import { MVT_TILE_HOST } from './mvtLayers';

export const dcuAxios = axios.create({ timeout: TIMEOUT });

export function dcuHeaders() {
  return DCU_BEARER_TOKEN ? { Authorization: DCU_BEARER_TOKEN } : undefined;
}

export function dcuItemsUrl(collection: string): string {
  return `https://${MVT_TILE_HOST}/items/${collection}`;
}
