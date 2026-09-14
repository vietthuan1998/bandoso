/**
 * Dữ liệu cứng cho các nguồn/lớp thành phố + phường/xã — tách khỏi
 * src/map/useHueMap.ts (nơi vẫn giữ hook tải dữ liệu và logic liên quan).
 */

export const GEOJSON_URL =
  'https://ioc-canhbao.hue.gov.vn/uploadfiles/40xaphuong_TPHue.json';
export const CITY_GEOJSON_URL =
  'https://ioc-canhbao.hue.gov.vn/uploadfiles/thanhphohuegeo.json';
export const STYLE_URL =
  'https://ioc-canhbao.hue.gov.vn/uploadfiles/map/hue_light_style.json';

export const CITY_SOURCE_ID = 'thanhphohue_source';
export const CITY_FILL_LAYER = 'thanhphohue_fill';
export const CITY_BORDER_LAYER = 'thanhphohue_border';
export const WARD_SOURCE_ID = 'xaphuong_source';
export const WARD_FILL_LAYER = 'xaphuong_fill';
export const WARD_BORDER_LAYER = 'xaphuong_border';
export const WARD_HIGHLIGHT_LAYER = 'xaphuong_highlight';
export const WARD_LABEL_LAYER = 'xaphuong_labels';

/** Bảng màu tô phường/xã theo thuộc tính `fColor` của feature (xem publicFillColor trong useHueMap.ts). */
export const WARD_COLORS: Record<string, string> = {
  '1': '#F4E390',
  '2': '#99D1E6',
  '3': '#ABD1AE',
  '4': '#F1A992',
};
