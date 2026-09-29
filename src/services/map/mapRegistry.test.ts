import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildLayerGroups,
  getMapRegistry,
  loadMapRegistry,
  normalizeRegistryLayer,
  resetMapRegistryForTests,
  type RegistryLayer,
} from './mapRegistry';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));

let mockAccessToken: string | null = null;
let mockTokenListener: ((token: string | null) => void) | null = null;
jest.mock('../auth/authClient', () => ({
  getAccessToken: () => mockAccessToken,
  subscribeToAccessTokenChange: (listener: (token: string | null) => void) => {
    mockTokenListener = listener;
    return () => {};
  },
}));

const mockedGet = axios.get as jest.Mock;

const BTS: RegistryLayer = {
  collectionKey: 'bts',
  directusCollection: 'bts',
  sourceLayer: 'bts',
  tileUrl: 'https://dcu.huecity.vn/mvt/{z}/{x}/{y}.mvt?collections=bts',
  label: 'Trạm BTS',
  menuGroup: 'telecom',
  geometryTypes: ['Point'],
  minZoom: 10,
  maxZoom: 12,
  color: '#e16d2d',
  icon: 'settings_input_antenna',
  capabilities: { list: true, statistics: false },
  dimensions: { updatedAtField: 'date_updated' },
  featureIdField: 'id',
  titleFields: ['station_code'],
  detailFields: ['station_code', 'operation_status'],
  hiddenFields: ['id', 'geom'],
  fieldLabels: { station_code: 'Mã trạm', operation_status: 'Trạng thái' },
  valueLabels: { operation_status: { '1': 'Bình thường' } },
};

function mockRegistryResponses(registryVersion: string, layers: RegistryLayer[]) {
  mockedGet.mockImplementation(async (url: string) => {
    if (url.endsWith('/map/config/version')) return { data: { registryVersion } };
    if (url.endsWith('/map/layers')) return { data: { registryVersion, layers } };
    if (url.endsWith('/catalog/layer-groups')) {
      return {
        data: {
          data: [
            { key: 'land', label: 'Đất đai, địa chính', icon: 'landscape' },
            { key: 'telecom', label: 'Viễn thông', icon: 'settings_input_antenna' },
          ],
        },
      };
    }
    throw new Error(`unexpected ${url}`);
  });
}

describe('normalizeRegistryLayer', () => {
  it('maps registry fields onto the app layer model', () => {
    expect(normalizeRegistryLayer(BTS)).toEqual({
      id: 'bts',
      collection: 'bts',
      sourceLayer: 'bts',
      tileUrl: BTS.tileUrl,
      label: 'Trạm BTS',
      groupKey: 'telecom',
      geometryTypes: ['point'],
      color: '#e16d2d',
      icon: 'antenna',
      minzoom: 10,
      maxzoom: 12,
      updatedAtField: 'date_updated',
      measureFields: [],
      featureIdField: 'id',
      directusIdField: 'id',
      geometryField: 'geom',
      titleFields: ['station_code'],
      searchableFields: [],
      listFields: [],
      detailFields: ['station_code', 'operation_status'],
      hiddenFields: ['id', 'geom'],
      fieldLabels: { station_code: 'Mã trạm', operation_status: 'Trạng thái' },
      valueLabels: { operation_status: { '1': 'Bình thường' } },
      objectValueKeys: {},
      capabilities: { list: true, detail: true, search: true, statistics: false },
    });
  });

  it('falls back to a generic icon and every geometry kind when the registry omits them', () => {
    const layer = normalizeRegistryLayer({
      ...BTS,
      icon: 'unknown_icon',
      geometryTypes: [],
      dimensions: undefined,
      featureIdField: undefined,
      detailFields: undefined,
    });
    expect(layer.featureIdField).toBe('id');
    expect(layer.detailFields).toEqual([]);
    expect(layer.icon).toBe('layers');
    expect(layer.geometryTypes).toEqual(['polygon', 'linestring', 'point']);
    expect(layer.updatedAtField).toBeNull();
  });
});

describe('buildLayerGroups', () => {
  it('keeps catalog order, drops empty groups and appends unknown menuGroups', () => {
    const layers = [
      normalizeRegistryLayer(BTS),
      normalizeRegistryLayer({ ...BTS, collectionKey: 'x', menuGroup: 'new-group' }),
    ];
    const groups = buildLayerGroups(layers, [
      { key: 'land', label: 'Đất đai', icon: 'landscape' },
      { key: 'telecom', label: 'Viễn thông', icon: 'settings_input_antenna' },
    ]);
    expect(groups).toEqual([
      { key: 'telecom', label: 'Viễn thông', icon: 'antenna' },
      { key: 'new-group', label: 'new-group', icon: 'layers' },
    ]);
  });
});

describe('loadMapRegistry', () => {
  beforeEach(async () => {
    resetMapRegistryForTests();
    mockedGet.mockReset();
    mockAccessToken = null;
    await AsyncStorage.clear();
  });

  it('downloads the registry and caches it by registryVersion', async () => {
    mockRegistryResponses('r1', [BTS]);

    const result = await loadMapRegistry();

    expect(result.status).toBe('ready');
    expect(result.layers.map(layer => layer.id)).toEqual(['bts']);
    expect(result.groups.map(group => group.label)).toEqual(['Viễn thông']);

    // Cùng version: chỉ poll /map/config/version, không tải lại /map/layers.
    resetMapRegistryForTests();
    mockedGet.mockClear();
    await loadMapRegistry();
    const urls = mockedGet.mock.calls.map(([url]) => url);
    expect(urls).toEqual([expect.stringContaining('/map/config/version')]);
  });

  it('serves the cached registry when the network is down', async () => {
    mockRegistryResponses('r1', [BTS]);
    await loadMapRegistry();

    resetMapRegistryForTests();
    mockedGet.mockRejectedValue(new Error('offline'));

    const result = await getMapRegistry();
    expect(result.layers.map(layer => layer.id)).toEqual(['bts']);
    // Đang dùng bản đã lưu -> phải báo và kèm thời điểm đồng bộ gần nhất.
    expect(result.stale).toBe(true);
    expect(result.syncedAt).toEqual(expect.any(String));
  });

  it('reports an error when there is neither network nor cache', async () => {
    mockedGet.mockRejectedValue(new Error('offline'));

    const result = await loadMapRegistry();

    expect(result).toEqual({ status: 'error', layers: [], groups: [] });
  });

  it('sends the access token when signed in and never reuses the public cache', async () => {
    mockRegistryResponses('r1', [BTS]);
    await loadMapRegistry();

    mockAccessToken = 'access-1';
    mockedGet.mockClear();
    mockRegistryResponses('r1', [BTS]);
    mockTokenListener?.('access-1');
    await loadMapRegistry();

    const layersCall = mockedGet.mock.calls.find(([url]) =>
      String(url).endsWith('/map/layers'),
    );
    // Cùng registryVersion nhưng khác đối tượng -> vẫn tải lại /map/layers.
    expect(layersCall).toBeDefined();
    expect(layersCall?.[1].headers).toEqual({
      Authorization: 'Bearer access-1',
    });
  });

  it('refreshes the sync time without rebuilding layers when the version is unchanged', async () => {
    mockRegistryResponses('r1', [BTS]);
    const first = await loadMapRegistry();
    const layers = first.layers;

    const second = await loadMapRegistry();

    expect(second.layers).toBe(layers);
    expect(second.stale).toBe(false);
  });
});
