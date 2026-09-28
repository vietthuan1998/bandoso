jest.mock('../api/dcuClient', () => ({
  dcuAxios: { get: jest.fn() },
  dcuHeaders: jest.fn(() => ({ Authorization: 'Bearer access-test' })),
  dcuItemsUrl: (collection: string) =>
    `https://dcu.huecity.vn/items/${collection}`,
}));

jest.mock('../map/mapRegistry', () => ({
  getMapRegistry: jest.fn(async () => ({
    status: 'ready',
    layers: [{ id: 'bts', collection: 'bts', groupKey: 'telecom' }],
    groups: [{ key: 'telecom', label: 'Viễn thông', icon: 'antenna' }],
  })),
}));

import { dcuAxios, dcuHeaders } from '../api/dcuClient';
import { fetchDataOverview } from './dataOverview';

const mockedGet = dcuAxios.get as jest.Mock;

describe('fetchDataOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ data: { data: [{ count: '3' }] } });
  });

  it('routes every collection count request through dcuAxios with dcuHeaders (not a raw axios call)', async () => {
    await fetchDataOverview();

    expect(mockedGet).toHaveBeenCalled();
    const [url, config] = mockedGet.mock.calls[0];
    expect(url).toContain('https://dcu.huecity.vn/items/');
    expect(config.headers).toEqual(dcuHeaders());
  });

  it('groups counts by the registry menuGroup', async () => {
    const overview = await fetchDataOverview();

    expect(overview.totalCollections).toBe(1);
    expect(overview.groups).toEqual([
      { id: 'telecom', label: 'Viễn thông', icon: 'antenna', count: 3 },
    ]);
  });
});
