import type { IconName } from '../../components/common/Icon';
import { dcuAxios, dcuHeaders, dcuItemsUrl } from '../api/dcuClient';
import { getMapRegistry } from '../map/mapRegistry';

export type DataOverviewGroupResult = {
  id: string;
  label: string;
  icon: IconName;
  count: number | null;
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
    const response = await dcuAxios.get<{ data: Array<{ count: string }> }>(
      dcuItemsUrl(collection),
      {
        params: { 'aggregate[count]': '*' },
        headers: dcuHeaders(),
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
  const { layers, groups } = await getMapRegistry();
  const countByLayerId = new Map<string, number | null>();

  await Promise.all(
    layers.map(async layer => {
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

  // Nhóm theo menuGroup của registry (cùng nhóm với menu lớp bản đồ).
  const groupResults: DataOverviewGroupResult[] = groups.map(group => {
    const counts = layers
      .filter(layer => layer.groupKey === group.key)
      .map(layer => countByLayerId.get(layer.id) ?? null);
    const readable = counts.filter((count): count is number => count !== null);
    return {
      id: group.key,
      label: group.label,
      icon: group.icon,
      count: readable.length
        ? readable.reduce((sum, count) => sum + count, 0)
        : null,
    };
  });

  return {
    totalObjects,
    readableCollections,
    totalCollections: layers.length,
    groups: groupResults,
  };
}
