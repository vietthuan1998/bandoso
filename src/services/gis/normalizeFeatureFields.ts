const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Tiện ích định dạng giá trị thuộc tính. Nhãn trường, thứ tự, trường ẩn đều
 * lấy từ registry (registryFeatureFields.ts) — không khai báo cứng ở đây.
 */
export type FieldLabels = {
  yes: string;
  no: string;
  male: string;
  female: string;
};

export type NormalizedFeatureLeaf = {
  key: string;
  label: string;
  value: string;
};

export type NormalizedFeatureField =
  | ({ kind: 'text' } & NormalizedFeatureLeaf)
  | {
      kind: 'list';
      key: string;
      label: string;
      items: NormalizedFeatureLeaf[][];
    };

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) return key;
  return spaced
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatIsoDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return `${pad2(date.getDate())}/${pad2(
    date.getMonth() + 1,
  )}/${date.getFullYear()}`;
}

export function parseIfJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== '[' && trimmed[0] !== '{')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function formatFieldValue(value: unknown, labels: FieldLabels): string {
  if (typeof value === 'boolean') return value ? labels.yes : labels.no;
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value.toLocaleString('vi-VN')
      : String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map(item => String(item).trim())
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const text = String(value).trim();
  return ISO_DATE_RE.test(text) ? formatIsoDate(text) : text;
}
