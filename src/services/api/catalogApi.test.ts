jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../map/mapRegistry', () => ({
  getRegistryVersion: jest.fn(async () => 'r1'),
}));

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRegistryVersion } from '../map/mapRegistry';
import {
  fetchCatalogWards,
  fetchWardBoundaries,
  resetCatalogMemoForTests,
} from './catalogApi';

const mockedGet = axios.get as jest.Mock;
const mockedVersion = getRegistryVersion as jest.Mock;

describe('catalog disk cache', () => {
  beforeEach(async () => {
    resetCatalogMemoForTests();
    mockedGet.mockReset();
    mockedVersion.mockResolvedValue('r1');
    await AsyncStorage.clear();
  });

  it('keeps /catalog/wards on disk: no network call on the next app start with the same registryVersion', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [{ code: 19900, name: 'Phường Thuận An', type: 'phuong' }],
      },
    });
    await fetchCatalogWards();

    // "Mở lại app": xoá bộ nhớ trong phiên, giữ đĩa.
    resetCatalogMemoForTests();
    mockedGet.mockReset();
    const wards = await fetchCatalogWards();

    expect(mockedGet).not.toHaveBeenCalled();
    expect(wards[0]).toMatchObject({ code: '19900', name: 'Phường Thuận An' });
  });

  it('still lists wards from disk when offline', async () => {
    mockedGet.mockResolvedValue({
      data: {
        data: [{ code: '19900', name: 'Phường Thuận An', type: 'phuong' }],
      },
    });
    await fetchCatalogWards();

    resetCatalogMemoForTests();
    mockedVersion.mockResolvedValue('r2');
    mockedGet.mockRejectedValue(new Error('offline'));

    expect((await fetchCatalogWards()).map(ward => ward.code)).toEqual([
      '19900',
    ]);
  });

  it('downloads the ward boundaries from /catalog/wards/geojson once per registryVersion', async () => {
    const geojson = { type: 'FeatureCollection', features: [] };
    mockedGet.mockResolvedValue({ data: geojson });

    const first = await fetchWardBoundaries();
    resetCatalogMemoForTests();
    const second = await fetchWardBoundaries();

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(mockedGet.mock.calls[0][0]).toMatch(/\/catalog\/wards\/geojson$/);
    expect(first.fromCache).toBe(false);
    expect(second).toMatchObject({ data: geojson, fromCache: true });
  });
});
