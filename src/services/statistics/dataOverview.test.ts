jest.mock('./statisticsApi', () => ({
  fetchStatisticsSummary: jest.fn(),
}));

jest.mock('../map/mapRegistry', () => ({
  getMapRegistry: jest.fn(async () => ({
    status: 'ready',
    layers: [
      { id: 'bts', collection: 'bts', groupKey: 'telecom' },
      { id: 'thua_dat', collection: 'thua_dat', groupKey: 'land' },
    ],
    groups: [
      { key: 'land', label: 'Đất đai', icon: 'landscape' },
      { key: 'telecom', label: 'Viễn thông', icon: 'antenna' },
    ],
  })),
}));

import { fetchStatisticsSummary } from './statisticsApi';
import { fetchDataOverview } from './dataOverview';

const mockedSummary = fetchStatisticsSummary as jest.Mock;

describe('fetchDataOverview', () => {
  beforeEach(() => {
    mockedSummary.mockResolvedValue({
      summary: {
        totals: {
          total: 350534,
          completed: null,
          inProgress: null,
          error: null,
          overdue: null,
          unknownWard: 64,
        },
        byLayer: [
          { collection: 'thua_dat', label: 'Thửa đất', count: 348144 },
          { collection: 'bts', label: 'Trạm BTS', count: 1831 },
          { collection: 'lop_moi', label: 'Lớp mới', count: 5 },
        ],
        byStatus: [],
        byWard: [],
        trend: [],
      },
      notes: ['Chênh lệch do 2.189 bản ghi mang mã cũ.'],
    });
  });

  it('takes totals from /statistics/summary instead of counting on the device', async () => {
    const overview = await fetchDataOverview();

    expect(mockedSummary).toHaveBeenCalledWith({});
    // totals.total của server, KHÔNG phải tổng cộng byLayer (349.980).
    expect(overview.total).toBe(350534);
    expect(overview.unknownWard).toBe(64);
    expect(overview.notes).toEqual(['Chênh lệch do 2.189 bản ghi mang mã cũ.']);
  });

  it('only arranges server byLayer rows under registry menu groups', async () => {
    const overview = await fetchDataOverview();

    expect(overview.groups).toEqual([
      {
        id: 'land',
        label: 'Đất đai',
        icon: 'landscape',
        layers: [{ collection: 'thua_dat', label: 'Thửa đất', count: 348144 }],
      },
      {
        id: 'telecom',
        label: 'Viễn thông',
        icon: 'antenna',
        layers: [{ collection: 'bts', label: 'Trạm BTS', count: 1831 }],
      },
      {
        id: '__other__',
        label: null,
        icon: 'layers',
        layers: [{ collection: 'lop_moi', label: 'Lớp mới', count: 5 }],
      },
    ]);
  });
});
