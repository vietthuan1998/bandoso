jest.mock('../api/dcuClient', () => ({
  dcuAxios: { get: jest.fn() },
  dcuHeaders: jest.fn(() => ({ Authorization: 'Bearer access-test' })),
}));

import { dcuAxios } from '../api/dcuClient';
import {
  buildChoroplethClasses,
  buildWardFillColor,
  CHOROPLETH_COLORS,
  colorForTotal,
  fetchWardTotals,
  NO_DATA_COLOR,
} from './wardChoropleth';

describe('buildChoroplethClasses', () => {
  it('splits non-zero totals into quantile classes from light to dark', () => {
    const classes = buildChoroplethClasses([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10000]);
    expect(classes).toEqual([
      { min: 1, max: 2, color: CHOROPLETH_COLORS[0] },
      { min: 3, max: 4, color: CHOROPLETH_COLORS[1] },
      { min: 5, max: 6, color: CHOROPLETH_COLORS[2] },
      { min: 7, max: 8, color: CHOROPLETH_COLORS[3] },
      { min: 9, max: 10000, color: CHOROPLETH_COLORS[4] },
    ]);
  });

  it('merges classes that share a break and still ends on the darkest colour', () => {
    const classes = buildChoroplethClasses([5, 5, 5, 5, 50]);
    expect(classes).toEqual([
      { min: 5, max: 5, color: CHOROPLETH_COLORS[0] },
      { min: 6, max: 50, color: CHOROPLETH_COLORS[4] },
    ]);
  });

  it('returns no classes when every ward is empty', () => {
    expect(buildChoroplethClasses([0, 0])).toEqual([]);
  });
});

describe('colorForTotal', () => {
  const classes = buildChoroplethClasses([1, 10, 100, 1000, 10000]);

  it('keeps empty wards out of the lowest class', () => {
    expect(colorForTotal(0, classes)).toBe(NO_DATA_COLOR);
    expect(colorForTotal(1, classes)).toBe(CHOROPLETH_COLORS[0]);
    expect(colorForTotal(10000, classes)).toBe(CHOROPLETH_COLORS[4]);
  });
});

describe('buildWardFillColor', () => {
  it('joins ward totals to features by administrative code, with a grey fallback', () => {
    const wards = [
      { wardId: '20179', wardName: 'Xã Nam Đông', total: 1 },
      { wardId: '20101', wardName: 'Xã A Lưới 4', total: 0 },
    ];
    expect(buildWardFillColor(wards, buildChoroplethClasses([1]))).toEqual([
      'match',
      ['to-string', ['get', 'code']],
      '20179',
      CHOROPLETH_COLORS[4],
      '20101',
      NO_DATA_COLOR,
      NO_DATA_COLOR,
    ]);
  });

  it('merges duplicate ward ids because MapLibre match labels must be unique', () => {
    const expression = buildWardFillColor(
      [
        { wardId: '20179', wardName: 'A', total: 2 },
        { wardId: '20179', wardName: 'A', total: 3 },
      ],
      buildChoroplethClasses([5]),
    ) as unknown[];
    expect(expression.filter(item => item === '20179')).toHaveLength(1);
  });

  it('falls back to a plain colour when there are no statistics', () => {
    expect(buildWardFillColor([], [])).toBe(NO_DATA_COLOR);
  });
});

describe('fetchWardTotals', () => {
  it('reads byWard from /statistics/summary through the authenticated client', async () => {
    (dcuAxios.get as jest.Mock).mockResolvedValue({
      data: { data: { byWard: [{ wardId: 20179, wardName: 'Xã Nam Đông', total: '12' }] } },
    });

    await expect(fetchWardTotals()).resolves.toEqual([
      { wardId: '20179', wardName: 'Xã Nam Đông', total: 12 },
    ]);
    const [url, config] = (dcuAxios.get as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/statistics\/summary$/);
    expect(config.headers).toEqual({ Authorization: 'Bearer access-test' });
  });
});
