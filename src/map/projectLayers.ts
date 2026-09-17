import type { ProjectCategoryId } from './types';

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
