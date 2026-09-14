import type { MvtGroupConfig, MvtLayerConfig } from '../map/mvtLayers';

/**
 * Dữ liệu cứng của registry MVT — tách khỏi src/map/mvtLayers.ts (nơi vẫn
 * giữ TYPE và các hàm build id/url liên quan) để gom mọi "dữ liệu tĩnh" của
 * app vào một chỗ (src/data/). src/map/mvtLayers.ts import lại rồi re-export
 * các hằng số này để mọi nơi đang `import { MVT_LAYERS } from '.../mvtLayers'`
 * không phải sửa gì.
 *
 * Tài liệu liệt kê đủ 14 collection (mục 8.1) và yêu cầu client dùng registry
 * động lấy từ backend (/api/v1/map/collections), không khai báo cứng tên
 * collection (mục 9.1). MVT_LAYERS dưới đây khai báo tĩnh đủ 14 collection để
 * hiển thị ngay — MỘT KHI có API registry thật, thay nguồn dữ liệu của mảng
 * này bằng kết quả gọi API đó thay vì để tĩnh trong code.
 *
 * MVT_LAYERS hiện có 15 phần tử: 14 collection trong mục 8.1 + collection
 * `gisportal_DinhHuongTruongChuyenBiet_P` (id nội bộ `cong-trinh-ngam-a`,
 * xem ghi chú tại chỗ khai báo — nhãn hiển thị và collection thật KHÔNG khớp
 * tên, cần xác nhận lại) được thêm theo yêu cầu riêng, ngoài danh sách tài liệu.
 */

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

// Màu theo chủ đề (bảng 8.1 của tài liệu), dùng chung cho cặp "hiện trạng" /
// "định hướng" của cùng một chủ đề — phân biệt bằng dashed, không phải màu.
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
    // Bảng 8.1: "Đất đai, địa chính" — "Polygon/line, zoom 12–22": thửa đất
    // là polygon, ranh giới/ghi chú địa chính có thể là line trong cùng
    // collection nên khai báo cả hai để vẽ đủ hai kiểu.
    geometryTypes: ['polygon', 'linestring'],
    color: '#0878bd',
    minzoom: 12,
    maxzoom: 22,
  },

  // Quy hoạch (9 collection). Bảng 8.1 ghi "Geometry thực tế" và cảnh báo rõ
  // "hậu tố P/L/A chỉ là gợi ý" — kiểm chứng thực tế qua Directus Items API
  // cho thấy gisportal_DinhHuongNghiaTrang_P (hậu tố "_P") trả về geom kiểu
  // "Point", không phải Polygon như hậu tố gợi ý. Vì không có gì đảm bảo 8
  // collection còn lại đúng theo hậu tố, khai báo đủ cả 3 kiểu hình học cho
  // toàn bộ nhóm — kiểu nào không có trong dữ liệu thật thì layer tương ứng
  // chỉ đơn giản không có gì để vẽ (vô hại).
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
    // Xác nhận thực tế (Items API, xem ghi chú đầu khối): geom là Point.
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
  {
    id: 'cong-trinh-ngam-a',
    // CHÚ Ý: id/labelKey vẫn ghi "công trình ngầm A" nhưng collection thật
    // đang trỏ tới gisportal_DinhHuongTruongChuyenBiet_P (Trường chuyên
    // biệt) — khác với qhpk_da2d144c3d_CongTrinhNgamA lúc entry này được
    // thêm ban đầu. Chưa rõ đây là thay đổi có chủ đích hay nhầm lẫn khi
    // sửa — cần xác nhận lại rồi đổi collection hoặc labelKey cho khớp.
    collection: 'gisportal_DinhHuongTruongChuyenBiet_P',
    labelKey: 'mvt.congTrinhNgamA',
    groupId: 'planning',
    geometryTypes: ['polygon', 'linestring', 'point'],
    color: THEME_COLOR.congTrinhNgam,
    dashed: true,
  },

  // Hạ tầng
  {
    id: 'tram-bts',
    collection: 'bts',
    labelKey: 'mvt.tramBts',
    groupId: 'infrastructure',
    // Bảng 8.1: "Trạm BTS" — "Point, icon ăng-ten".
    geometryTypes: ['point'],
    color: '#f97316',
  },

  // IoT
  {
    id: 'rain-water-stations',
    collection: 'rain_water_stations',
    labelKey: 'mvt.rainWaterStations',
    groupId: 'iot',
    // Bảng 8.1: "Trạm đo mưa" — "Point, icon mưa".
    geometryTypes: ['point'],
    color: '#2563eb',
  },
  {
    id: 'water-level-station',
    collection: 'water_level_station',
    labelKey: 'mvt.waterLevelStation',
    groupId: 'iot',
    // Bảng 8.1: "Trạm đo mực nước" — "Point, icon mực nước".
    geometryTypes: ['point'],
    color: '#0891b2',
  },
  {
    id: 'iot-wind-station',
    collection: 'iot_wind_station',
    labelKey: 'mvt.iotWindStation',
    groupId: 'iot',
    // Bảng 8.1: "Trạm đo gió" — "Point, icon gió".
    geometryTypes: ['point'],
    color: '#65a30d',
  },
];
