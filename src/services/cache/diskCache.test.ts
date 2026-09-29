import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedFetch } from './diskCache';

describe('cachedFetch', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('downloads once, then serves the disk copy while registryVersion is unchanged', async () => {
    const load = jest.fn(async () => ['19900', '19858']);

    const first = await cachedFetch({ key: 'wards', version: 'r1', load });
    const second = await cachedFetch({ key: 'wards', version: 'r1', load });

    expect(first).toMatchObject({ fromCache: false, stale: false });
    expect(second).toMatchObject({
      data: ['19900', '19858'],
      fromCache: true,
      stale: false,
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('downloads again when registryVersion changes', async () => {
    await cachedFetch({ key: 'wards', version: 'r1', load: async () => ['a'] });
    const load = jest.fn(async () => ['b']);

    const result = await cachedFetch({ key: 'wards', version: 'r2', load });

    expect(load).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ data: ['b'], fromCache: false });
  });

  it('falls back to the saved copy (marked stale, with its sync time) when offline', async () => {
    const saved = await cachedFetch({
      key: 'wards',
      version: 'r1',
      load: async () => ['a'],
    });

    const result = await cachedFetch({
      key: 'wards',
      version: 'r2',
      load: async () => {
        throw new Error('offline');
      },
    });

    expect(result).toEqual({
      data: ['a'],
      fromCache: true,
      stale: true,
      syncedAt: saved.syncedAt,
    });
  });

  it('rethrows when offline and nothing was ever saved', async () => {
    await expect(
      cachedFetch({
        key: 'nothing',
        version: 'r1',
        load: async () => {
          throw new Error('offline');
        },
      }),
    ).rejects.toThrow('offline');
  });

  it('keeps large payloads in a file, not in AsyncStorage', async () => {
    const geojson = { type: 'FeatureCollection', features: [{ id: '19900' }] };
    await cachedFetch({
      key: 'wards-geojson',
      version: 'r1',
      load: async () => geojson,
      storage: 'file',
    });

    const meta = await AsyncStorage.getItem('@huemaps/cache/wards-geojson');
    expect(JSON.parse(meta as string)).not.toHaveProperty('data');

    const load = jest.fn();
    const cached = await cachedFetch({
      key: 'wards-geojson',
      version: 'r1',
      load,
      storage: 'file',
    });
    expect(load).not.toHaveBeenCalled();
    expect(cached.data).toEqual(geojson);
  });
});
