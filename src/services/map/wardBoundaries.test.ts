jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

const WARDS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: '20179',
      properties: { code: '20179', name: 'Xã Nam Đông', type: 'xa', areaKm2: 175.95 },
      geometry: { type: 'MultiPolygon', coordinates: [] },
    },
  ],
};

describe('loadWardBoundaries', () => {
  let loadWardBoundaries: typeof import('./wardBoundaries').loadWardBoundaries;
  let mockedGet: jest.Mock;

  // Nạp lại module mỗi test để cache trong bộ nhớ bắt đầu trống.
  beforeEach(() => {
    jest.resetModules();
    mockedGet = require('axios').default.get;
    loadWardBoundaries = require('./wardBoundaries').loadWardBoundaries;
  });

  it('downloads the ~4 MB GeoJSON once and reuses it for later screens', async () => {
    mockedGet.mockResolvedValue({ data: WARDS });

    const first = await loadWardBoundaries();
    const second = await loadWardBoundaries();

    expect(first).toBe(second);
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet.mock.calls[0][0]).toMatch(/\/catalog\/wards\/geojson$/);
  });

  it('drops a failed request so the next call retries', async () => {
    mockedGet.mockRejectedValueOnce(new Error('offline'));
    await expect(loadWardBoundaries()).rejects.toThrow('offline');

    mockedGet.mockResolvedValueOnce({ data: WARDS });
    await expect(loadWardBoundaries()).resolves.toEqual(WARDS);
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });
});
