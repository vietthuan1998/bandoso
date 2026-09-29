import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
} from 'geojson';

export type WardProperties = {
  maDonViHanhChinh?: string;
  madonvihanhchinh?: string;
  ward_id?: string;
  ma_xa?: string;
  maxa?: string;
  danhTuChung?: string;
  danhTuChun?: string;
  diaDanh?: string;
  nhan?: string;
  Nhan?: string;
  nhanBanDo?: string;
  xDaiDien?: string | number;
  yDaiDien?: string | number;
  dienTich?: string | number;
  dientich?: string | number;
  quyMoDanSo?: string | number;
  viTriDiaLy?: string;
  diaChiUB?: string;
  GhiChu?: string | number;
  publicWardId?: string;
  publicFillColor?: string;
  [key: string]: unknown;
};

export type WardFeature = Feature<Polygon | MultiPolygon, WardProperties>;
export type WardFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  WardProperties
>;

export type Ward = {
  id: string;
  code: string;
  name: string;
  label: string;
  type: string;
  area: number | null;
  population: string;
  geographicDescription: string;
  committeeAddress: string;
  note: string;
  properties: WardProperties;
};
