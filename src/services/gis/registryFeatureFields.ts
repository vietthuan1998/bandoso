import type { MvtLayerConfig } from '../map/mvtLayers';
import {
  formatFieldValue,
  humanizeKey,
  parseIfJson,
  type FieldLabels,
  type NormalizedFeatureField,
} from './normalizeFeatureFields';

type Properties = Record<string, unknown>;

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Khoá feature theo layer.featureIdField — không mặc định là "id". */
export function getFeatureId(
  layer: MvtLayerConfig,
  properties: Properties,
): string | null {
  const value = properties[layer.featureIdField];
  return isPresent(value) ? String(value).trim() : null;
}

/** Giá trị khác rỗng đầu tiên theo layer.titleFields; hết thì dùng tên lớp. */
export function resolveFeatureTitle(
  layer: MvtLayerConfig,
  properties: Properties,
): string {
  for (const field of layer.titleFields) {
    if (isPresent(properties[field])) return String(properties[field]).trim();
  }
  return layer.label;
}

/**
 * Giá trị hiển thị của một trường: tách object theo objectValueKeys (thuộc
 * tính object trong tile MVT thường bị chuỗi hoá JSON nên parse trước), dịch
 * mã qua valueLabels, rồi định dạng số/ngày/boolean. Object không tách được
 * trả rỗng — không bao giờ in "[object Object]" hay JSON thô.
 */
export function resolveFieldValue(
  layer: MvtLayerConfig,
  field: string,
  properties: Properties,
  labels: FieldLabels,
): string {
  let value = parseIfJson(properties[field]);

  const objectKey = layer.objectValueKeys[field];
  if (objectKey && isPlainObject(value)) value = value[objectKey];

  const valueLabel = isPresent(value)
    ? layer.valueLabels[field]?.[String(value)]
    : undefined;
  if (valueLabel !== undefined) return valueLabel;

  if (!isPresent(value)) return '';
  if (Array.isArray(value)) {
    // Mảng giá trị đơn giản thì nối lại; mảng object không có cấu hình -> bỏ.
    return value.every(item => typeof item !== 'object' || item === null)
      ? formatFieldValue(value, labels)
      : '';
  }
  if (typeof value === 'object') return '';
  return formatFieldValue(value, labels);
}

/**
 * Panel chi tiết theo registry: đúng thứ tự detailFields, nhãn từ fieldLabels,
 * bỏ mọi trường trong hiddenFields và trường không có giá trị.
 */
export function buildFeatureDetailFields(
  layer: MvtLayerConfig,
  properties: Properties,
  labels: FieldLabels,
): NormalizedFeatureField[] {
  const hidden = new Set(layer.hiddenFields);
  return layer.detailFields
    .filter(field => !hidden.has(field))
    .map(field => ({
      kind: 'text' as const,
      key: field,
      label: layer.fieldLabels[field] ?? humanizeKey(field),
      value: resolveFieldValue(layer, field, properties, labels),
    }))
    .filter(field => field.value !== '');
}
