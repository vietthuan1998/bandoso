import type { MvtGroupConfig, MvtLayerConfig } from '../map/mvtLayers';

export const MVT_GROUPS: MvtGroupConfig[] = [
  { id: 'landData', labelKey: 'mvt.groups.landData', color: '#0878bd' },
  { id: 'planning', labelKey: 'mvt.groups.planning', color: '#7c3aed' },
  {
    id: 'infrastructure',
    labelKey: 'mvt.groups.infrastructure',
    color: '#f97316',
  },
  { id: 'iot', labelKey: 'mvt.groups.iot', color: '#2563eb' },
];

export const MVT_TILE_HOST = 'dcu.huecity.vn';

const THEME_COLOR = {
  khuCongNghiep: '#0ea5e9',
  xuLyChatThai: '#dc2626',
  nghiaTrang: '#78716c',
  congNgheCao: '#7c3aed',
  coSoKhcn: '#0d9488',
  congTrinhNgam: '#92400e',
} as const;

export const MVT_LAYERS: MvtLayerConfig[] = [
  // Đất đai
  {
    id: 'thua-dat',
    collection: 'thua_dat',
    labelKey: 'mvt.thuaDat',
    groupId: 'landData',
    geometryTypes: ['polygon', 'linestring'],
    color: '#0878bd',
    minzoom: 12,
    maxzoom: 22,
  },
  {
    id: 'khu-cong-nghiep-hien-trang',
    collection: 'gisportal_HienTrangKhuCongNghiep_P',
    labelKey: 'mvt.khuCongNghiepHienTrang',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.khuCongNghiep,
  },
  {
    id: 'khu-cong-nghiep-dinh-huong',
    collection: 'gisportal_DinhHuongPhatTrienKhuCongNghiep_P',
    labelKey: 'mvt.khuCongNghiepDinhHuong',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.khuCongNghiep,
    dashed: true,
  },
  {
    id: 'xu-ly-chat-thai-hien-trang',
    collection: 'gisportal_HienTrangKhuXuLyChatThai_P',
    labelKey: 'mvt.xuLyChatThaiHienTrang',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.xuLyChatThai,
  },
  {
    id: 'xu-ly-chat-thai-dinh-huong',
    collection: 'gisportal_DinhHuongKhuXuLyChatThai_P',
    labelKey: 'mvt.xuLyChatThaiDinhHuong',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.xuLyChatThai,
    dashed: true,
  },
  {
    id: 'nghia-trang-hien-trang',
    collection: 'gisportal_HienTrangNghiaTrang_P',
    labelKey: 'mvt.nghiaTrangHienTrang',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.nghiaTrang,
  },
  {
    id: 'nghia-trang-dinh-huong',
    collection: 'gisportal_DinhHuongNghiaTrang_P',
    labelKey: 'mvt.nghiaTrangDinhHuong',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.nghiaTrang,
    dashed: true,
  },
  {
    id: 'cong-nghe-cao-dinh-huong',
    collection: 'gisportal_DinhHuongKhuCongNgheCao_P',
    labelKey: 'mvt.congNgheCaoDinhHuong',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.congNgheCao,
    dashed: true,
  },
  {
    id: 'co-so-khcn-dinh-huong',
    collection: 'gisportal_DinhHuongCoSoKHCN_P',
    labelKey: 'mvt.coSoKhcnDinhHuong',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.coSoKhcn,
    dashed: true,
  },
  {
    id: 'co-so-khcn-hien-trang',
    collection: 'gisportal_HienTrangCoSoKHCN_P',
    labelKey: 'mvt.coSoKhcnHienTrang',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.coSoKhcn,
  },

  // Hạ tầng
  {
    id: 'tram-bts',
    collection: 'bts',
    labelKey: 'mvt.tramBts',
    groupId: 'infrastructure',
    geometryTypes: ['point'],
    color: '#f97316',
  },

  // IoT
  {
    id: 'rain-water-stations',
    collection: 'rain_water_stations',
    labelKey: 'mvt.rainWaterStations',
    groupId: 'iot',
    geometryTypes: ['point'],
    color: '#2563eb',
  },
  {
    id: 'water-level-station',
    collection: 'water_level_station',
    labelKey: 'mvt.waterLevelStation',
    groupId: 'iot',
    geometryTypes: ['point'],
    color: '#0891b2',
  },
  {
    id: 'iot-wind-station',
    collection: 'iot_wind_station',
    labelKey: 'mvt.iotWindStation',
    groupId: 'iot',
    geometryTypes: ['point'],
    color: '#65a30d',
  },
];
