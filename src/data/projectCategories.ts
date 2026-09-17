import type { ProjectCategory, ProjectCategoryId } from '../map/types';

export const PUBLIC_ASSET_BASE_URL = 'https://bandoso.hue.gov.vn';

export const PROJECT_CATEGORIES: ProjectCategory[] = [
  {
    id: 'calling',
    alias: 'Dự án đang kêu gọi đầu tư',
    color: '#dc2626',
    sourceUrl: `${PUBLIC_ASSET_BASE_URL}/data/bandoduan/DA_DangKeuGoiDauTu.geojson`,
  },
  {
    id: 'selecting-investor',
    alias:
      'Dự án đã chấp thuận chủ trương đầu tư, đang triển khai lựa chọn nhà đầu tư',
    color: '#8b5cf6',
    sourceUrl: `${PUBLIC_ASSET_BASE_URL}/data/bandoduan/DA_DangTrienKhai_LuaChon_NhaDauTu.geojson`,
  },
  {
    id: 'constructing',
    alias: 'Dự án đã chấp thuận nhà đầu tư, đang triển khai xây dựng',
    color: '#f97316',
    sourceUrl: `${PUBLIC_ASSET_BASE_URL}/data/bandoduan/DA_DangTrienKhai_XayDung.geojson`,
  },
  {
    id: 'operating',
    alias: 'Dự án đã đi vào hoạt động',
    color: '#16a34a',
    sourceUrl: `${PUBLIC_ASSET_BASE_URL}/data/bandoduan/DA_hoatdong.geojson`,
  },
];

export const INITIAL_PROJECT_CATEGORY_VISIBILITY = Object.fromEntries(
  PROJECT_CATEGORIES.map(category => [category.id, true]),
) as Record<ProjectCategoryId, boolean>;
