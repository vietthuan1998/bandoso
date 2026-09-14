import type { ProjectCategoryId } from './types';

/**
 * File này giữ các hàm build id lớp bản đồ cho dự án đầu tư. Dữ liệu cứng
 * (PUBLIC_ASSET_BASE_URL, PROJECT_CATEGORIES, INITIAL_PROJECT_CATEGORY_VISIBILITY)
 * đã chuyển sang src/data/projectCategories.ts — import lại rồi re-export ở
 * đây để mọi nơi đang `import { PROJECT_CATEGORIES } from '.../map/projectLayers'`
 * không phải sửa gì.
 */
export {
  PUBLIC_ASSET_BASE_URL,
  PROJECT_CATEGORIES,
  INITIAL_PROJECT_CATEGORY_VISIBILITY,
} from '../data/projectCategories';

export const projectSourceId = (id: ProjectCategoryId) =>
  `projects-${id}-source`;
export const projectFillLayerId = (id: ProjectCategoryId) =>
  `projects-${id}-fill`;
export const projectBorderLayerId = (id: ProjectCategoryId) =>
  `projects-${id}-border`;
export const projectCircleLayerId = (id: ProjectCategoryId) =>
  `projects-${id}-circle`;
