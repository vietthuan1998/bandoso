import type { IconName } from '../../components/common/Icon';
import { getMapRegistry } from '../map/mapRegistry';
import { fetchStatisticsSummary } from './statisticsApi';

export type DataOverviewLayer = {
  collection: string;
  label: string;
  count: number;
};

export type DataOverviewGroup = {
  id: string;
  /** null = lớp không có trong registry hiện tại (nhóm "Khác"). */
  label: string | null;
  icon: IconName;
  layers: DataOverviewLayer[];
};

export type DataOverview = {
  /** totals.total do server chốt — không cộng từ các lớp. */
  total: number;
  /** Bản ghi không quy được về phường xã nào — bắt buộc hiển thị. */
  unknownWard: number;
  /** meta.notes — giải thích phần lệch số liệu. */
  notes: string[];
  groups: DataOverviewGroup[];
};

const OTHER_GROUP_ID = '__other__';

/**
 * Tổng quan dữ liệu = GET /statistics/summary (không bộ lọc). Mọi con số do
 * backend chốt (tài liệu mục 11): client chỉ xếp các dòng byLayer vào nhóm
 * menu của registry để hiển thị, không tự đếm hay cộng lại.
 */
export async function fetchDataOverview(): Promise<DataOverview> {
  const [{ summary, notes }, registry] = await Promise.all([
    fetchStatisticsSummary({}),
    getMapRegistry(),
  ]);

  const groupOf = new Map<string, string>();
  for (const layer of registry.layers) {
    groupOf.set(layer.id, layer.groupKey);
    groupOf.set(layer.collection, layer.groupKey);
  }

  const byGroup = new Map<string, DataOverviewLayer[]>();
  for (const item of summary.byLayer) {
    const groupId = groupOf.get(item.collection) ?? OTHER_GROUP_ID;
    const list = byGroup.get(groupId) ?? [];
    list.push({
      collection: item.collection,
      label: item.label,
      count: item.count,
    });
    byGroup.set(groupId, list);
  }

  const groups: DataOverviewGroup[] = registry.groups
    .filter(group => byGroup.has(group.key))
    .map(group => ({
      id: group.key,
      label: group.label,
      icon: group.icon,
      layers: byGroup.get(group.key) ?? [],
    }));
  const known = new Set(groups.map(group => group.id));
  for (const [groupId, layers] of byGroup) {
    if (known.has(groupId)) continue;
    groups.push({ id: groupId, label: null, icon: 'layers', layers });
  }

  return {
    total: summary.totals.total,
    unknownWard: summary.totals.unknownWard,
    notes,
    groups,
  };
}
