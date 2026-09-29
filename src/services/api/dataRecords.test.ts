jest.mock('./dcuClient', () => ({
  dcuAxios: { get: jest.fn() },
  dcuHeaders: jest.fn(() => undefined),
  dcuItemsUrl: (collection: string) =>
    `https://dcu.huecity.vn/items/${collection}`,
}));
jest.mock('../statistics/statisticsApi', () => ({
  fetchStatisticsGroups: jest.fn(),
}));
jest.mock('../map/mapRegistry', () => ({ getMapRegistry: jest.fn() }));

import { dcuAxios } from './dcuClient';
import { fetchStatisticsGroups } from '../statistics/statisticsApi';
import type { MvtLayerConfig } from '../map/mvtLayers';
import {
  fetchDataRecordsPage,
  fetchFeatureRecord,
  normalizeRecord,
  resetWardFieldCacheForTests,
} from './dataRecords';

const mockedGet = dcuAxios.get as jest.Mock;
const mockedGroups = fetchStatisticsGroups as jest.Mock;
const LABELS = { yes: 'Có', no: 'Không', male: 'Nam', female: 'Nữ' };
const NO_FILTERS = { wards: [], dateFrom: null, dateTo: null };

const LAYER: MvtLayerConfig = {
  id: 'water_level_station',
  collection: 'water_level_station',
  sourceLayer: 'water_level_station',
  tileUrl: 'https://dcu.huecity.vn/mvt/{z}/{x}/{y}.mvt',
  label: 'Trạm đo mực nước',
  groupKey: 'iot',
  geometryTypes: ['point'],
  color: '#0f9b8e',
  icon: 'waterLevel',
  updatedAtField: 'date_updated',
  measureFields: [],
  featureIdField: 'id',
  directusIdField: 'id',
  geometryField: 'geom',
  titleFields: ['name', 'code'],
  searchableFields: ['name', 'code', 'address'],
  listFields: ['name', 'code', 'address', 'water_station_type'],
  detailFields: [],
  hiddenFields: ['id', 'geom'],
  fieldLabels: {
    code: 'Mã trạm',
    address: 'Địa chỉ',
    water_station_type: 'Loại trạm',
  },
  valueLabels: {},
  objectValueKeys: { water_station_type: 'desc' },
  capabilities: { list: true, detail: true, search: true, statistics: true },
};

function lastParams() {
  return mockedGet.mock.calls[mockedGet.mock.calls.length - 1][1].params;
}

describe('normalizeRecord', () => {
  it('uses registry titleFields, directusIdField and listFields (no guessed field names)', () => {
    const record = normalizeRecord(
      LAYER,
      {
        id: 7,
        name: '',
        code: 'WL-01',
        address: 'Thuận An',
        water_station_type: '{"desc":"Tháp báo lũ","name":"flood_3m"}',
        date_updated: '2026-09-20T08:00:00+07:00',
      },
      LABELS,
    );
    expect(record.id).toBe('7');
    // name rỗng -> lấy code theo thứ tự titleFields.
    expect(record.title).toBe('WL-01');
    expect(record.lines).toEqual([
      { key: 'address', label: 'Địa chỉ', value: 'Thuận An' },
      { key: 'water_station_type', label: 'Loại trạm', value: 'Tháp báo lũ' },
    ]);
    expect(record.updatedAt).toBe('2026-09-20T08:00:00+07:00');
  });
});

describe('fetchDataRecordsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetWardFieldCacheForTests();
    mockedGet.mockResolvedValue({
      data: { data: [], meta: { filter_count: 0 } },
    });
  });

  it('searches only the registry searchableFields', async () => {
    await fetchDataRecordsPage({
      layer: LAYER,
      search: 'lũ',
      filters: NO_FILTERS,
      labels: LABELS,
    });
    expect(JSON.parse(lastParams().filter)).toEqual({
      _and: [
        {
          _or: [
            { name: { _icontains: 'lũ' } },
            { code: { _icontains: 'lũ' } },
            { address: { _icontains: 'lũ' } },
          ],
        },
      ],
    });
  });

  it('filters wards by administrative code on the field the server reports', async () => {
    mockedGroups.mockResolvedValue({ field: 'ma_xa', items: [] });
    await fetchDataRecordsPage({
      layer: { ...LAYER, id: 'thua_dat', collection: 'thua_dat' },
      filters: { wards: ['19900', '19858'], dateFrom: null, dateTo: null },
      labels: LABELS,
    });
    expect(mockedGroups).toHaveBeenCalledWith('thua_dat', 'ward', {});
    expect(JSON.parse(lastParams().filter)).toEqual({
      _and: [{ ma_xa: { _in: ['19900', '19858'] } }],
    });
  });

  it('returns nothing (instead of an unfiltered list) when the layer has no real ward field', async () => {
    mockedGroups.mockResolvedValue({ field: '(chỉ mục địa bàn)', items: [] });
    const page = await fetchDataRecordsPage({
      layer: LAYER,
      filters: { wards: ['19900'], dateFrom: null, dateTo: null },
      labels: LABELS,
    });
    expect(page.items).toEqual([]);
    expect(page.unsupported).toEqual({
      wards: false,
      dates: true,
      search: true,
    });
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('applies the shared date range on updatedAtField', async () => {
    await fetchDataRecordsPage({
      layer: LAYER,
      filters: { wards: [], dateFrom: '2026-09-01', dateTo: '2026-09-23' },
      labels: LABELS,
    });
    expect(JSON.parse(lastParams().filter)).toEqual({
      _and: [
        {
          date_updated: {
            _gte: '2026-09-01T00:00:00',
            _lte: '2026-09-23T23:59:59',
          },
        },
      ],
    });
  });
});

describe('fetchFeatureRecord', () => {
  beforeEach(() => jest.clearAllMocks());

  it('looks the record up by featureIdField when it differs from directusIdField (gisportal_*)', async () => {
    mockedGet.mockResolvedValue({ data: { data: [{ id: 1, objectid: 42 }] } });
    const record = await fetchFeatureRecord(
      { ...LAYER, featureIdField: 'objectid', directusIdField: 'id' },
      '42',
    );
    expect(record).toEqual({ id: 1, objectid: 42 });
    expect(mockedGet.mock.calls[0][0]).toBe(
      'https://dcu.huecity.vn/items/water_level_station',
    );
    expect(JSON.parse(lastParams().filter)).toEqual({
      objectid: { _eq: '42' },
    });
  });
});
