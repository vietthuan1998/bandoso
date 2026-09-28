jest.mock('../api/dcuClient', () => ({
  dcuAxios: { get: jest.fn() },
  dcuHeaders: jest.fn(() => ({ Authorization: 'Bearer access-test' })),
}));

import { AxiosError, AxiosHeaders } from 'axios';
import { dcuAxios } from '../api/dcuClient';
import {
  buildStatisticsParams,
  fetchStatisticsGroups,
  fetchStatisticsMeasures,
  fetchStatisticsSummary,
  fetchStatisticsTrend,
  formatTrendBucket,
  statisticsErrorKind,
  toTrendPoints,
} from './statisticsApi';

const mockedGet = dcuAxios.get as jest.Mock;

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('fail', String(status), config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: {},
  });
}

beforeEach(() => mockedGet.mockReset());

describe('buildStatisticsParams', () => {
  it('joins list filters with commas and omits empty ones', () => {
    expect(
      buildStatisticsParams(
        { collections: ['thua_dat', 'bts'], wards: ['19900', '19858'], dateTo: '2026-09-01' },
        { bucket: 'month' },
      ),
    ).toEqual({
      bucket: 'month',
      collections: 'thua_dat,bts',
      wards: '19900,19858',
      dateTo: '2026-09-01',
    });
    expect(buildStatisticsParams({ collections: [], dateFrom: null })).toEqual({});
  });
});

describe('fetchStatisticsSummary', () => {
  it('keeps nulls (not measured) and returns meta.notes', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          totals: {
            total: 350534,
            completed: null,
            inProgress: null,
            error: null,
            overdue: null,
            unknownWard: 64,
          },
          byLayer: [{ collection: 'thua_dat', label: 'Thửa đất', count: 348144 }],
          byStatus: [],
          byWard: [{ wardId: 19858, wardName: 'Phường Phong Thái', total: 0, completionRatio: null }],
          trend: [],
        },
        meta: { notes: ['64 bản ghi chưa gán phường xã'] },
      },
    });

    const { summary, notes } = await fetchStatisticsSummary({ wards: ['19858'] });

    expect(summary.totals.completed).toBeNull();
    expect(summary.totals.unknownWard).toBe(64);
    expect(summary.byWard[0]).toMatchObject({ wardId: '19858', total: 0 });
    expect(notes).toEqual(['64 bản ghi chưa gán phường xã']);
    const [url, config] = mockedGet.mock.calls[0];
    expect(url).toMatch(/\/statistics\/summary$/);
    expect(config.params).toEqual({ wards: '19858' });
    expect(config.headers).toEqual({ Authorization: 'Bearer access-test' });
  });
});

describe('per-collection endpoints', () => {
  it('requests trend with the bucket and measures with the registry measureFields', async () => {
    mockedGet.mockResolvedValue({ data: { data: [] } });

    await fetchStatisticsTrend('thua_dat', 'quarter', { collections: ['thua_dat'] });
    await fetchStatisticsMeasures('thua_dat', ['dien_tich'], {
      collections: ['thua_dat'],
      wards: ['19900'],
    });

    expect(mockedGet.mock.calls[0][0]).toMatch(/\/statistics\/thua_dat\/trend$/);
    expect(mockedGet.mock.calls[0][1].params).toEqual({ bucket: 'quarter' });
    expect(mockedGet.mock.calls[1][0]).toMatch(/\/statistics\/thua_dat\/measures$/);
    expect(mockedGet.mock.calls[1][1].params).toEqual({ fields: 'dien_tich', wards: '19900' });
  });
});

describe('fetchStatisticsGroups', () => {
  it('groups by a logical dimension and keeps the key for drill-down', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          dimension: 'ward',
          field: 'ma_xa',
          total: 348144,
          unknownCount: 0,
          items: [{ key: 19858, label: 'Phường Phong Thái', count: 32605, ratio: 0.0937 }],
        },
      },
    });

    const result = await fetchStatisticsGroups('thua_dat', 'ward', {
      collections: ['thua_dat'],
      dateTo: '2026-09-01',
    });

    expect(result.items[0]).toEqual({
      key: '19858',
      label: 'Phường Phong Thái',
      count: 32605,
      ratio: 0.0937,
    });
    const [url, config] = mockedGet.mock.calls[0];
    expect(url).toMatch(/\/statistics\/thua_dat\/groups$/);
    expect(config.params).toEqual({ dimension: 'ward', dateTo: '2026-09-01' });
  });
});

describe('statisticsErrorKind', () => {
  it('separates "not logged in" and "no permission" from other failures', () => {
    expect(statisticsErrorKind(httpError(401))).toBe('unauthorized');
    expect(statisticsErrorKind(httpError(403))).toBe('forbidden');
    expect(statisticsErrorKind(httpError(500))).toBe('error');
    expect(statisticsErrorKind(new Error('offline'))).toBe('error');
  });
});

describe('formatTrendBucket / toTrendPoints', () => {
  it('labels day, month and quarter buckets', () => {
    expect(formatTrendBucket('2026-09-28', 'day')).toBe('28/09');
    expect(formatTrendBucket('2026-09', 'month')).toBe('09/2026');
    expect(formatTrendBucket('2026-09-01', 'month')).toBe('09/2026');
    expect(formatTrendBucket('2026-Q3', 'quarter')).toBe('Q3/2026');
    expect(formatTrendBucket('2026-07-01', 'quarter')).toBe('Q3/2026');
    expect(formatTrendBucket('tuần 12', 'day')).toBe('tuần 12');
  });

  it('maps API points onto the chart model', () => {
    expect(toTrendPoints([{ bucket: '2026-09', count: 5 }], 'month')).toEqual([
      { date: '2026-09', label: '09/2026', count: 5 },
    ]);
  });
});
