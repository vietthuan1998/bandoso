import '../../i18n';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchSummary = jest.fn();
const mockFetchGroups = jest.fn();

jest.mock('../../services/statistics/statisticsApi', () => {
  const actual = jest.requireActual('../../services/statistics/statisticsApi');
  return {
    ...actual,
    fetchStatisticsSummary: (...args: unknown[]) => mockFetchSummary(...args),
    fetchStatisticsGroups: (...args: unknown[]) => mockFetchGroups(...args),
    fetchStatisticsTrend: jest.fn(async () => []),
    fetchStatisticsMeasures: jest.fn(async () => []),
  };
});
jest.mock('../../services/api/catalogApi', () => ({
  fetchCatalogWards: jest.fn(async () => []),
}));
jest.mock('../../services/map/mapRegistry', () => ({
  useMapRegistry: () => ({ status: 'ready', layers: [], groups: [], reload: jest.fn() }),
}));

import { AxiosError, AxiosHeaders } from 'axios';
import { StatisticsScreen } from './StatisticsScreen';

let renderer!: TestRenderer.ReactTestRenderer;

const textsOf = () =>
  renderer.root
    .findAllByType(Text)
    .map(node => [].concat(node.props.children as never).join(''));

async function pressText(label: string) {
  const target = renderer.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      typeof node.props.onPress === 'function' &&
      node.findAllByType(Text).some(text => text.props.children === label),
  )[0];
  if (!target) throw new Error(`Không tìm thấy nút "${label}"`);
  await act(async () => {
    target.props.onPress();
  });
}

async function render() {
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <StatisticsScreen />
      </SafeAreaProvider>,
    );
  });
  return textsOf();
}

const SUMMARY = {
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
  byWard: [
    { wardId: '19858', wardName: 'Phường Phong Thái', total: 32669, completed: null, error: null, overdue: null, completionRatio: null, lastUpdatedAt: null },
    { wardId: '20101', wardName: 'Xã A Lưới 4', total: 0, completed: null, error: null, overdue: null, completionRatio: null, lastUpdatedAt: null },
  ],
  trend: [],
};

describe('StatisticsScreen (API /statistics)', () => {
  beforeEach(() => {
    mockFetchSummary.mockReset();
    mockFetchGroups.mockReset();
  });

  it('follows the mandatory display rules of the statistics API', async () => {
    mockFetchSummary.mockResolvedValue({
      summary: SUMMARY,
      notes: ['Tổng theo phường nhỏ hơn tổng chung do 64 bản ghi chưa gán địa bàn.'],
    });

    const texts = await render();

    expect(texts).toContain('350.534');
    // unknownWard luôn hiển thị.
    expect(texts).toContain('Chưa xác định phường, xã: 64');
    // meta.notes bắt buộc hiển thị.
    expect(texts).toContain('• Tổng theo phường nhỏ hơn tổng chung do 64 bản ghi chưa gán địa bàn.');
    // null = chưa đo được, không vẽ thành 0.
    expect(texts.some(text => text.startsWith('Chưa đo được'))).toBe(true);
    expect(texts).not.toContain('Hoàn thành');
    // byWard giữ cả phường có giá trị 0.
    expect(texts).toContain('Xã A Lưới 4');
    // byStatus rỗng -> không có biểu đồ trạng thái.
    expect(texts).not.toContain('Theo trạng thái');
  });

  it('groups a selected layer by dimension and drills down by the group key', async () => {
    mockFetchSummary.mockResolvedValue({ summary: SUMMARY, notes: [] });
    mockFetchGroups.mockResolvedValue({
      dimension: 'ward',
      field: 'ma_xa',
      total: 348144,
      unknownCount: 12,
      items: [{ key: '19858', label: 'Phường Phong Thái', count: 32605, ratio: 0.0937 }],
    });
    await render();

    // Chọn lớp từ mục "Theo lớp dữ liệu" (drill-down theo byLayer).
    await pressText('Thửa đất');
    expect(mockFetchGroups).toHaveBeenLastCalledWith(
      'thua_dat',
      'ward',
      expect.objectContaining({ collections: ['thua_dat'] }),
    );
    const texts = textsOf();
    expect(texts).toContain('Nhóm theo chiều');
    expect(texts).toContain('Trường: ma_xa');
    expect(texts).toContain('12'); // unknownCount được hiển thị
    // ratio 0.0937 -> 2 chữ số thập phân.
    expect(texts).toContain('32.605\n9,37%');

    // Chạm một nhóm phường -> key trở thành bộ lọc ?wards=.
    await pressText('Phường Phong Thái');
    expect(mockFetchSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({ collections: ['thua_dat'], wards: ['19858'] }),
    );
  });

  it('asks guests to sign in instead of showing a generic error on 401', async () => {
    const config = { headers: new AxiosHeaders() };
    mockFetchSummary.mockRejectedValue(
      new AxiosError('401', '401', config, null, {
        status: 401,
        statusText: '',
        headers: {},
        config,
        data: {},
      }),
    );

    const texts = await render();

    expect(texts).toContain('Đăng nhập ở tab Cá nhân để xem số liệu thống kê.');
  });
});
