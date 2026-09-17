import { useCallback, useEffect, useRef, useState } from 'react';
import { describeHttpError, httpClient } from '../api/httpClient';
import {
  CITY_BORDER_LAYER,
  CITY_FILL_LAYER,
  CITY_GEOJSON_URL,
  CITY_SOURCE_ID,
  GEOJSON_URL,
  STYLE_URL,
  WARD_BORDER_LAYER,
  WARD_COLORS,
  WARD_FILL_LAYER,
  WARD_HIGHLIGHT_LAYER,
  WARD_LABEL_LAYER,
  WARD_SOURCE_ID,
} from '../data/mapSources';
import i18n from '../i18n';
import {
  INITIAL_PROJECT_CATEGORY_VISIBILITY,
  PROJECT_CATEGORIES,
} from './projectLayers';
import type {
  ProjectCategory,
  ProjectCategoryId,
  ProjectProperties,
  ProjectSearchItem,
  SelectedProject,
  Ward,
  WardFeatureCollection,
  WardProperties,
} from './types';

export {
  CITY_BORDER_LAYER,
  CITY_FILL_LAYER,
  CITY_GEOJSON_URL,
  CITY_SOURCE_ID,
  GEOJSON_URL,
  STYLE_URL,
  WARD_BORDER_LAYER,
  WARD_FILL_LAYER,
  WARD_HIGHLIGHT_LAYER,
  WARD_LABEL_LAYER,
  WARD_SOURCE_ID,
};

function text(value: unknown): string {
  return value === null ||
    value === undefined ||
    String(value).trim().toLowerCase() === 'null'
    ? ''
    : String(value).trim();
}

function code(props: WardProperties): string {
  return text(
    props.maDonViHanhChinh ??
      props.madonvihanhchinh ??
      props.ward_id ??
      props.ma_xa ??
      props.maxa,
  );
}

function number(value: unknown): number | null {
  const result = Number(text(value).replace(',', '.'));
  return Number.isFinite(result) ? result : null;
}

function normalizeWard(props: WardProperties): Ward {
  const wardCode = code(props);
  const name = text(
    props.diaDanh ?? props.nhan ?? props.Nhan ?? props.nhanBanDo,
  );
  const label = text(
    props.nhanBanDo ?? props.nhan ?? props.Nhan ?? props.diaDanh,
  );
  return {
    id: text(props.publicWardId) || wardCode || label || name,
    code: wardCode,
    name,
    label,
    type: text(props.danhTuChung ?? props.danhTuChun),
    area: number(props.dienTich ?? props.dientich),
    population: text(props.quyMoDanSo),
    geographicDescription: text(props.viTriDiaLy),
    committeeAddress: text(props.diaChiUB),
    note: text(props.GhiChu),
    properties: props,
  };
}

function normalizeProject(
  category: ProjectCategory,
  properties: ProjectProperties,
): SelectedProject {
  return {
    id:
      text(properties.OBJECTID) ||
      `${category.id}-${text(properties.tenDuAn ?? properties.name)}`,
    categoryId: category.id,
    categoryAlias: category.alias,
    color: category.color,
    properties,
  };
}

export function geometryBounds(
  geometry: unknown,
): [number, number, number, number] | null {
  if (!geometry || typeof geometry !== 'object' || !('coordinates' in geometry))
    return null;
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (
      coordinates.length >= 2 &&
      typeof coordinates[0] === 'number' &&
      typeof coordinates[1] === 'number'
    ) {
      minLng = Math.min(minLng, coordinates[0]);
      minLat = Math.min(minLat, coordinates[1]);
      maxLng = Math.max(maxLng, coordinates[0]);
      maxLat = Math.max(maxLat, coordinates[1]);
      return;
    }
    coordinates.forEach(visit);
  };

  visit((geometry as { coordinates: unknown }).coordinates);
  return Number.isFinite(minLng) ? [minLng, minLat, maxLng, maxLat] : null;
}

export function useHueMap() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const wardDataRef = useRef<WardFeatureCollection | null>(null);
  const [wardData, setWardData] = useState<WardFeatureCollection | null>(null);

  const [cityVisible, setCityVisible] = useState(true);
  const [citySelected, setCitySelected] = useState(false);
  const [hiddenWardIds, setHiddenWardIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);

  const [projectLayerVisible, setProjectLayerVisible] = useState(false);
  const [projectCategoryVisibility, setProjectCategoryVisibility] = useState<
    Record<ProjectCategoryId, boolean>
  >(() => ({ ...INITIAL_PROJECT_CATEGORY_VISIBILITY }));
  const [selectedProject, setSelectedProject] =
    useState<SelectedProject | null>(null);
  const [projects, setProjects] = useState<ProjectSearchItem[]>([]);

  const selectedWardIdRef = useRef<string | null>(null);
  selectedWardIdRef.current = selectedWard?.id ?? null;

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await httpClient.get<WardFeatureCollection>(
          GEOJSON_URL,
        );
        const data = response.data;
        if (disposed) return;
        data.features.forEach((feature, index) => {
          const props = feature.properties;
          const wardCode = code(props);
          const name = text(props.nhanBanDo ?? props.diaDanh ?? props.Nhan);
          props.publicWardId = wardCode || name || String(index);
          props.publicFillColor = WARD_COLORS[text(props.fColor)] ?? '#D1D5DB';
        });
        wardDataRef.current = data;
        setWardData(data);
        setWards(
          data.features
            .map(feature => normalizeWard(feature.properties))
            .filter(ward => ward.code || ward.name)
            .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
        );
        setError(null);
      } catch (reason) {
        if (!disposed) {
          setError(`${i18n.t('map.loadError')}: ${describeHttpError(reason)}`);
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    load();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const loadProjectsForSearch = async () => {
      try {
        const categoryProjects = await Promise.all(
          PROJECT_CATEGORIES.map(async category => {
            const response = await httpClient.get<{
              features?: Array<{
                properties?: ProjectProperties | null;
                geometry?: unknown;
              }>;
            }>(category.sourceUrl);
            const data = response.data;
            return (data.features ?? []).flatMap(feature => {
              if (!feature.properties) return [];
              const project = normalizeProject(category, feature.properties);
              return [
                {
                  ...project,
                  name:
                    text(
                      feature.properties.tenDuAn ?? feature.properties.name,
                    ) || i18n.t('map.unnamedProject'),
                  location: text(feature.properties.diaDiem),
                  investor: text(
                    feature.properties.nhaDauTu ?? feature.properties.chuDauTu,
                  ),
                  bounds: geometryBounds(feature.geometry),
                },
              ];
            });
          }),
        );
        if (!disposed) setProjects(categoryProjects.flat());
      } catch {
        if (!disposed) setProjects([]);
      }
    };
    loadProjectsForSearch();
    return () => {
      disposed = true;
    };
  }, []);

  const toggleCity = useCallback((visible: boolean) => {
    setCityVisible(visible);
    if (!visible) setCitySelected(false);
  }, []);
  const selectCity = useCallback(() => {
    setCityVisible(true);
    setSelectedWard(null);
    setSelectedProject(null);
    setCitySelected(true);
  }, []);
  const toggleAllWards = useCallback(
    (visible: boolean) => {
      setHiddenWardIds(
        visible ? new Set() : new Set(wards.map(ward => ward.id)),
      );
      if (!visible) setSelectedWard(null);
    },
    [wards],
  );
  const selectWard = useCallback((ward: Ward) => {
    setHiddenWardIds(current => {
      if (!current.has(ward.id)) return current;
      const next = new Set(current);
      next.delete(ward.id);
      return next;
    });
    setCitySelected(false);
    setSelectedProject(null);
    setSelectedWard(ward);
  }, []);
  const toggleProjectLayer = useCallback((visible: boolean) => {
    setProjectLayerVisible(visible);
    if (!visible) setSelectedProject(null);
  }, []);
  const activateProjectLayer = useCallback(() => {
    setProjectLayerVisible(true);
    setCitySelected(false);
    setSelectedWard(null);
    setSelectedProject(null);
  }, []);
  const toggleProjectCategory = useCallback(
    (id: ProjectCategoryId, visible: boolean) => {
      setProjectCategoryVisibility(current => ({ ...current, [id]: visible }));
      setSelectedProject(current =>
        current?.categoryId === id && !visible ? null : current,
      );
    },
    [],
  );
  const selectProject = useCallback((project: SelectedProject) => {
    setProjectLayerVisible(true);
    setProjectCategoryVisibility(current => ({
      ...current,
      [project.categoryId]: true,
    }));
    setCitySelected(false);
    setSelectedWard(null);
    setSelectedProject(project);
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedWard(null);
    setCitySelected(false);
    setSelectedProject(null);
  }, []);

  const wardBoundsById = useCallback(
    (wardId: string): [number, number, number, number] | null => {
      const feature = wardDataRef.current?.features.find(
        item => text(item.properties.publicWardId) === wardId,
      );
      return geometryBounds(feature?.geometry);
    },
    [],
  );

  return {
    loading,
    error,
    wards,
    wardData,
    cityVisible,
    citySelected,
    hiddenWardIds,
    selectedWard,
    projectLayerVisible,
    projectCategoryVisibility,
    selectedProject,
    projects,
    toggleCity,
    selectCity,
    toggleAllWards,
    selectWard,
    toggleProjectLayer,
    activateProjectLayer,
    toggleProjectCategory,
    selectProject,
    clearSelection,
    wardBoundsById,
  };
}

export { normalizeWard, normalizeProject };
