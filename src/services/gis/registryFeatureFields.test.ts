import { normalizeRegistryLayer } from '../map/mapRegistry';
import {
  buildFeatureDetailFields,
  getFeatureId,
  resolveFeatureTitle,
  resolveFieldValue,
} from './registryFeatureFields';

const LABELS = { yes: 'Có', no: 'Không', male: 'Nam', female: 'Nữ' };

const baseLayer = {
  tileUrl: 'https://dcu.huecity.vn/mvt/{z}/{x}/{y}.mvt',
  menuGroup: 'test',
  color: '#000000',
};

// Trích từ registry thật (GET /map/layers).
const khuCongNghiep = normalizeRegistryLayer({
  ...baseLayer,
  collectionKey: 'gisportal_HienTrangKhuCongNghiep_P',
  label: 'Hiện trạng Khu công nghiệp',
  featureIdField: 'objectid',
  titleFields: ['ten'],
  detailFields: ['ten', 'dientich', 'objectid'],
  hiddenFields: ['objectid', 'geom'],
  fieldLabels: { ten: 'Tên đối tượng', dientich: 'Diện tích' },
});

const bts = normalizeRegistryLayer({
  ...baseLayer,
  collectionKey: 'bts',
  label: 'Trạm BTS',
  titleFields: ['station_code'],
  detailFields: ['station_code', 'operation_status'],
  fieldLabels: { station_code: 'Mã trạm', operation_status: 'Tình trạng' },
  valueLabels: { operation_status: { '1': 'Bình thường', '2': 'Ngừng hoạt động' } },
});

const waterLevel = normalizeRegistryLayer({
  ...baseLayer,
  collectionKey: 'water_level_station',
  label: 'Trạm đo mực nước',
  titleFields: ['name', 'code'],
  detailFields: ['name', 'water_station_type'],
  fieldLabels: { water_station_type: 'Loại trạm' },
  objectValueKeys: { water_station_type: 'desc' },
});

describe('getFeatureId', () => {
  it('reads the key from featureIdField instead of assuming "id"', () => {
    expect(getFeatureId(khuCongNghiep, { id: 'wrong', objectid: 42 })).toBe('42');
    expect(getFeatureId(khuCongNghiep, { id: 'wrong' })).toBeNull();
  });
});

describe('resolveFeatureTitle', () => {
  it('uses the first non-empty titleField, then the layer label', () => {
    expect(resolveFeatureTitle(waterLevel, { name: ' ', code: 'MN-01' })).toBe('MN-01');
    expect(resolveFeatureTitle(waterLevel, {})).toBe('Trạm đo mực nước');
  });
});

describe('resolveFieldValue', () => {
  it('translates codes through valueLabels', () => {
    expect(resolveFieldValue(bts, 'operation_status', { operation_status: 2 }, LABELS)).toBe(
      'Ngừng hoạt động',
    );
  });

  it('unwraps objectValueKeys, including JSON-stringified tile properties', () => {
    const object = { id: 3, desc: 'Trạm tự động' };
    expect(
      resolveFieldValue(waterLevel, 'water_station_type', { water_station_type: object }, LABELS),
    ).toBe('Trạm tự động');
    expect(
      resolveFieldValue(
        waterLevel,
        'water_station_type',
        { water_station_type: JSON.stringify(object) },
        LABELS,
      ),
    ).toBe('Trạm tự động');
  });

  it('never leaks raw objects and formats numbers the Vietnamese way', () => {
    expect(resolveFieldValue(bts, 'station_code', { station_code: { a: 1 } }, LABELS)).toBe('');
    expect(resolveFieldValue(khuCongNghiep, 'dientich', { dientich: 12345.5 }, LABELS)).toBe(
      '12.345,5',
    );
  });
});

describe('buildFeatureDetailFields', () => {
  it('follows detailFields order and labels, dropping hiddenFields and empty values', () => {
    const fields = buildFeatureDetailFields(
      khuCongNghiep,
      { objectid: 42, geom: '{"type":"Point"}', dientich: 50, ten: 'KCN Phú Bài', extra: 'x' },
      LABELS,
    );
    expect(fields).toEqual([
      { kind: 'text', key: 'ten', label: 'Tên đối tượng', value: 'KCN Phú Bài' },
      { kind: 'text', key: 'dientich', label: 'Diện tích', value: '50' },
    ]);
  });
});
