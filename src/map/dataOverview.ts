import axios from 'axios';
import { DCU_BEARER_TOKEN } from '@env';
import type { IconName } from '../components/HueMapScreen/Icon';
import { MVT_LAYERS, MVT_TILE_HOST } from './mvtLayers';

export type OverviewGroupConfig = {
  id: string;
  labelKey: string;
  icon: IconName;
  layerIds: string[];
};

import { DATA_OVERVIEW_GROUPS } from '../data/dataOverviewGroups';
export { DATA_OVERVIEW_GROUPS };

export type DataOverviewGroupResult = {
  id: string;
  labelKey: string;
  icon: IconName;
};

export type DataOverview = {
  totalObjects: number;
  readableCollections: number;
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
    return null;
  }
}

export async function fetchDataOverview(): Promise<DataOverview> {
  const countByLayerId = new Map<string, number | null>();

  await Promise.all(
    MVT_LAYERS.map(async layer => {
      countByLayerId.set(
        layer.id,
        await fetchCollectionCount(layer.collection),
      );
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

  const groups: DataOverviewGroupResult[] = DATA_OVERVIEW_GROUPS.map(group => {
    const counts = group.layerIds.map(id => countByLayerId.get(id) ?? null);
    const readable = counts.filter((count): count is number => count !== null);
    return {
      id: group.id,
      labelKey: group.labelKey,
      icon: group.icon,
      count: readable.length
        ? readable.reduce((sum, count) => sum + count, 0)
        : null,
    };
  });

  return {
    totalObjects,
    readableCollections,
    totalCollections: MVT_LAYERS.length,
    groups,
  };
}
