import '../../i18n';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockFetchSummary = jest.fn();
const mockFetchGroups = jest.fn();
const mockFetchTrend = jest.fn();

jest.mock('../../services/statistics/statisticsApi', () => {
  const actual = jest.requireActual('../../services/statistics/statisticsApi');
  return {
    ...actual,
    fetchStatisticsSummary: (...args: unknown[]) => mockFetchSummary(...args),
    fetchStatisticsGroups: (...args: unknown[]) => mockFetchGroups(...args),
    fetchStatisticsTrend: (...args: unknown[]) => mockFetchTrend(...args),
    fetchStatisticsMeasures: jest.fn(async () => []),
  };
});
const mockFetchStatuses = jest.fn(async () => [] as unknown[]);
jest.mock('../../services/api/catalogApi', () => ({
  fetchCatalogWards: jest.fn(async () => []),
  fetchCatalogStatuses: (...args: unknown[]) =>
    mockFetchStatuses(...(args as [])),
  shortWardName: (name: string) => name,
}));
let mockProfile: unknown = null;
jest.mock('../../hooks/useAuthProfile', () => ({
  useAuthProfile: () => mockProfile,
}));
jest.mock('../../services/map/mapRegistry', () => ({
  useMapRegistry: () => ({
    status: 'ready',
    layers: [],
    groups: [],
    reload: jest.fn(),
  }),
}));

import { AxiosError, AxiosHeaders } from 'axios';
import { StatisticsScreen } from './StatisticsScreen';
import { DonutChart } from '../../components/statistics/DonutChart';

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

async function render(onRequestLogin?: () => void) {
  await act(async () => {
    renderer = TestRenderer.create(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <StatisticsScreen onRequestLogin={onRequestLogin} />
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
    {
      wardId: '19858',
      wardName: 'Phường Phong Thái',
      total: 32669,
      completed: null,
      error: null,
      overdue: null,
      completionRatio: null,
      lastUpdatedAt: null,
    },
    {
      wardId: '20101',
      wardName: 'Xã A Lưới 4',
      total: 0,
      completed: null,
      error: null,
      overdue: null,
      completionRatio: null,
      lastUpdatedAt: null,
    },
  ],
  trend: [],
};

describe('StatisticsScreen (API /statistics)', () => {
  beforeEach(() => {
    mockFetchSummary.mockReset();
    mockFetchGroups.mockReset();
    mockFetchStatuses.mockReset();
    mockFetchTrend.mockReset().mockResolvedValue([]);
    mockFetchStatuses.mockResolvedValue([]);
    mockProfile = null;
  });

  it('follows the mandatory display rules of the statistics API', async () => {
    mockFetchSummary.mockResolvedValue({
      summary: SUMMARY,
      notes: [
        'Tổng theo phường nhỏ hơn tổng chung do 64 bản ghi chưa gán địa bàn.',
      ],
    });

    const texts = await render();

    expect(texts).toContain('350.534');
    // unknownWard luôn hiển thị.
    expect(texts).toContain('Chưa xác định phường, xã: 64');
    // meta.notes bắt buộc hiển thị.
    expect(texts).toContain(
      '• Tổng theo phường nhỏ hơn tổng chung do 64 bản ghi chưa gán địa bàn.',
    );
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
      items: [
        {
          key: '19858',
          label: 'Phường Phong Thái',
          count: 32605,
          ratio: 0.0937,
        },
      ],
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

    const onRequestLogin = jest.fn();
    const texts = await render(onRequestLogin);

    expect(texts).toContain('Bạn cần đăng nhập để xem số liệu thống kê.');
    // Thử lại vô ích khi chưa đăng nhập -> nút dẫn sang tab đăng nhập.
    expect(texts).not.toContain('Thử lại');
    await pressText('Đến đăng nhập');
    expect(onRequestLogin).toHaveBeenCalledTimes(1);
  });

  it('shows the server message and requestId for other errors (by error.code)', async () => {
    const config = { headers: new AxiosHeaders() };
    mockFetchSummary.mockRejectedValue(
      new AxiosError('403', '403', config, null, {
        status: 403,
        statusText: '',
        headers: {},
        config,
        data: {
          error: {
            code: 'FORBIDDEN_WARD_SCOPE',
            message: 'Tài khoản không có quyền xem dữ liệu của phường/xã này.',
            requestId: 'b1f0a2c4',
          },
        },
      }),
    );

    const texts = await render(jest.fn());

    expect(texts).toContain(
      'Tài khoản không có quyền xem dữ liệu của phường/xã này. (Mã tra cứu: b1f0a2c4)',
    );
    // Lỗi khác 401 vẫn cho thử lại.
    expect(texts).toContain('Thử lại');
    expect(texts).not.toContain('Đến đăng nhập');
  });

  it('colours the status breakdown from /catalog/statuses instead of a client palette', async () => {
    mockFetchStatuses.mockResolvedValue([
      { code: 'draft', label: 'Khởi tạo', color: '#94a3b8' },
      { code: 'approved', label: 'Đã duyệt', color: '#16a34a' },
    ]);
    mockFetchSummary.mockResolvedValue({
      summary: {
        ...SUMMARY,
        byStatus: [
          { status: 'approved', label: 'Đã duyệt', count: 10 },
          { status: 'mystery', label: 'Lạ', count: 1 },
        ],
      },
      notes: [],
    });

    await render();

    const segments = renderer.root.findByType(DonutChart).props.segments;
    expect(segments.map((segment: { color: string }) => segment.color)).toEqual(
      ['#16a34a', '#94a3b8'],
    );
  });

  it('shows the export button only with the report.export permission', async () => {
    mockFetchSummary.mockResolvedValue({ summary: SUMMARY, notes: [] });

    expect(await render()).not.toContain('Xuất báo cáo');

    mockProfile = {
      permissions: ['statistics.read', 'report.export'],
      wardScope: { type: 'all', wardIds: [] },
    };
    expect(await render()).toContain('Xuất báo cáo');
  });

  it('hides the trend panel when the trend API fails', async () => {
    mockFetchSummary.mockResolvedValue({ summary: SUMMARY, notes: [] });
    mockFetchGroups.mockResolvedValue({
      dimension: 'ward',
      field: 'ma_xa',
      total: 0,
      unknownCount: 0,
      items: [],
    });
    mockFetchTrend.mockRejectedValue(new Error('500'));
    await render();

    await pressText('Thửa đất');

    expect(mockFetchTrend).toHaveBeenCalledWith(
      'thua_dat',
      'month',
      expect.anything(),
    );
    expect(textsOf()).not.toContain('Xu hướng');
    expect(textsOf()).not.toContain('Không tải được số liệu thống kê.');
  });

  it('keeps the trend panel with its empty state when the API succeeds with no points', async () => {
    mockFetchSummary.mockResolvedValue({ summary: SUMMARY, notes: [] });
    mockFetchGroups.mockResolvedValue({
      dimension: 'ward',
      field: 'ma_xa',
      total: 0,
      unknownCount: 0,
      items: [],
    });
    await render();

    await pressText('Thửa đất');

    expect(textsOf()).toContain('Xu hướng');
    expect(textsOf()).toContain('Chưa có dữ liệu xu hướng');
  });

  it('shows the scope the server actually applied when it narrows the requested wards', async () => {
    mockFetchSummary.mockResolvedValue({
      summary: {
        ...SUMMARY,
        scope: {
          collections: [],
          wardIds: ['19858'],
          dateFrom: null,
          dateTo: null,
          scopeType: 'ward',
        },
      },
      notes: [],
    });

    await render();

    // Chưa chọn phường nào nhưng tài khoản chỉ được xem Phong Thái -> thẻ
    // tổng ghi theo phạm vi thực tế, không phải "tất cả".
    // Một lần ở dòng phường xã, thêm một lần ở nhãn thẻ tổng.
    expect(textsOf().filter(text => text === 'Phường Phong Thái')).toHaveLength(
      2,
    );
  });

  it('does not show the scope notice when the applied scope matches the filter', async () => {
    mockFetchSummary.mockResolvedValue({
      summary: {
        ...SUMMARY,
        scope: {
          collections: [],
          wardIds: [],
          dateFrom: null,
          dateTo: null,
          scopeType: 'all',
        },
      },
      notes: [],
    });

    await render();

    // Không thu hẹp -> thẻ tổng giữ nhãn mặc định.
    expect(textsOf()).toContain('Tổng số bản ghi');
  });

  it('shows only server counts per layer, never a client-computed share of the total', async () => {
    mockFetchSummary.mockResolvedValue({ summary: SUMMARY, notes: [] });

    const texts = await render();

    expect(texts).toContain('348.144');
    // 348144 / 350534 = 99,3% — con số app tự tính, không được hiển thị.
    expect(texts.some(text => text.includes('%'))).toBe(false);
  });

  it('labels "no ward filter" as the assigned wards for a ward-scoped account, without a redundant notice', async () => {
    mockProfile = {
      permissions: ['statistics.read'],
      wardScope: { type: 'ward', wardIds: ['19858'] },
    };
    mockFetchSummary.mockResolvedValue({
      summary: {
        ...SUMMARY,
        scope: {
          collections: [],
          wardIds: ['19858'],
          dateFrom: null,
          dateTo: null,
          scopeType: 'ward',
        },
      },
      notes: [],
    });

    const texts = await render();

    expect(texts).toContain('Phường, xã được giao (1)');
    expect(texts).not.toContain('Tất cả phường, xã');
  });
});
