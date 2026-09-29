import { useCallback, useEffect, useRef, useState } from 'react';
import { describeHttpError } from '../services/api/apiError';
import {
  fetchWardBoundaries,
  type WardBoundaryCollection,
} from '../services/api/catalogApi';
import {
  CITY_BORDER_LAYER,
  CITY_FILL_LAYER,
  CITY_GEOJSON_URL,
  CITY_SOURCE_ID,
  STYLE_URL,
  WARD_BORDER_LAYER,
  WARD_COLORS,
  WARD_FILL_LAYER,
  WARD_HIGHLIGHT_LAYER,
  WARD_LABEL_LAYER,
  WARD_SOURCE_ID,
} from '../constants/mapSources';
import i18n from '../i18n';
import type { Ward, WardFeatureCollection, WardProperties } from '../types/map';

export {
  CITY_BORDER_LAYER,
  CITY_FILL_LAYER,
  CITY_GEOJSON_URL,
  CITY_SOURCE_ID,
  STYLE_URL,
  WARD_BORDER_LAYER,
  WARD_FILL_LAYER,
  WARD_HIGHLIGHT_LAYER,
  WARD_LABEL_LAYER,
  WARD_SOURCE_ID,
};

const WARD_TYPE_LABEL: Record<string, string> = {
  phuong: 'Phường',
  xa: 'Xã',
  thi_tran: 'Thị trấn',
};

/**
 * Ranh giới /catalog/wards/geojson (tài liệu mục 5) -> thuộc tính mà bản đồ,
 * panel phường xã và ô tìm kiếm đang đọc. Mã ĐVHC (`code`) là khoá duy nhất;
 * màu lấy `color` của server, chưa có thì xoay vòng bảng màu nền.
 */
export function toWardFeatureCollection(
  source: WardBoundaryCollection,
): WardFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: source.features.map((feature, index) => {
      const props = feature.properties;
      const wardCode = text(props.code ?? feature.id);
      const properties: WardProperties = {
        maDonViHanhChinh: wardCode,
        diaDanh: props.name,
        nhanBanDo: props.name,
        danhTuChung: WARD_TYPE_LABEL[props.type] ?? '',
        dienTich: props.areaKm2 ?? undefined,
        quyMoDanSo: props.population ?? undefined,
        viTriDiaLy: props.geographicPosition ?? undefined,
        diaChiUB: props.officeAddress ?? undefined,
        publicWardId: wardCode || String(index),
        publicFillColor:
          text(props.color) || WARD_COLORS[String((index % 4) + 1)],
      };
      return {
        type: 'Feature',
        id: wardCode || index,
        geometry: feature.geometry,
        properties,
      };
    }),
  };
}

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

  const selectedWardIdRef = useRef<string | null>(null);
  selectedWardIdRef.current = selectedWard?.id ?? null;

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      setLoading(true);
      try {
        // Cache file theo registryVersion; mất mạng thì dùng bản đã lưu.
        const result = await fetchWardBoundaries();
        if (disposed) return;
        const data = toWardFeatureCollection(result.data);
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

  const toggleCity = useCallback((visible: boolean) => {
    setCityVisible(visible);
    if (!visible) setCitySelected(false);
  }, []);
  const selectCity = useCallback(() => {
    setCityVisible(true);
    setSelectedWard(null);
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
    setSelectedWard(ward);
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedWard(null);
    setCitySelected(false);
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
    toggleCity,
    selectCity,
    toggleAllWards,
    selectWard,
    clearSelection,
    wardBoundsById,
  };
}

export { normalizeWard };
