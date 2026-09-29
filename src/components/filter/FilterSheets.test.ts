import {
  allWardsLabel,
  wardFilterLabel,
  wardsWithinScope,
} from './FilterSheets';
import type { UserProfile } from '../../services/auth/authClient';

const t = (key: string, options?: Record<string, unknown>) =>
  options?.count !== undefined ? `${key}:${options.count}` : key;

function profile(wardScope: UserProfile['wardScope']): UserProfile {
  return {
    id: 'u1',
    username: null,
    fullName: null,
    unit: null,
    roles: [],
    permissions: [],
    wardScope,
    allowedCollections: [],
  };
}

const WARDS = [
  { code: '19900', name: 'Phường Thuận An', type: 'phuong' as const },
  { code: '19858', name: 'Phường Phong Thái', type: 'phuong' as const },
  { code: '20179', name: 'Xã Nam Đông', type: 'xa' as const },
];

describe('ward scope labels', () => {
  it('says "all wards" for city-wide accounts and guests', () => {
    expect(allWardsLabel(null, t)).toBe('statistics.filters.allWards');
    expect(allWardsLabel(profile({ type: 'all', wardIds: [] }), t)).toBe(
      'statistics.filters.allWards',
    );
  });

  it('says "assigned wards (N)" for ward-scoped accounts', () => {
    const officer = profile({ type: 'ward', wardIds: ['19900', '19858'] });
    expect(allWardsLabel(officer, t)).toBe('filters.assignedWards:2');
    expect(wardFilterLabel([], WARDS, t, officer)).toBe(
      'filters.assignedWards:2',
    );
  });

  it('only offers assigned wards in the picker for ward-scoped accounts', () => {
    const officer = profile({ type: 'ward', wardIds: ['19900', '19858'] });
    expect(wardsWithinScope(WARDS, officer).map(ward => ward.code)).toEqual([
      '19900',
      '19858',
    ]);
    expect(wardsWithinScope(WARDS, null)).toHaveLength(3);
  });
});
