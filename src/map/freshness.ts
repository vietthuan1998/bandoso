export type LayerFreshness = 'recent' | 'stale' | 'unknown';

export const RECENT_DAYS = 7;

export function classifyFreshness(
  maxUpdatedAt: string | null | undefined,
): LayerFreshness {
  if (!maxUpdatedAt) return 'unknown';
  const diffDays = (Date.now() - new Date(maxUpdatedAt).getTime()) / 86_400_000;
  return diffDays <= RECENT_DAYS ? 'recent' : 'stale';
}
