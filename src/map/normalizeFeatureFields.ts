const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export type FieldLabels = {
  yes: string;
  no: string;
  male: string;
  female: string;
};

const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  ho_ten: 'Họ tên',
  dia_chi: 'Địa chỉ',
  gioi_tinh: 'Giới tính',
  giay_to_tuy_than: 'Số giấy tờ tùy thân',
  chu_so_huu: 'Chủ sở hữu',
  ten_xa: 'Xã/Phường',
  ma_xa: 'Mã xã/phường',
  dien_tich: 'Diện tích (m²)',
  muc_dich_su_dung: 'Mục đích sử dụng đất',
  co_giay_phep: 'Có giấy phép',
  ghi_chu: 'Ghi chú',
  so_hieu_to_ban_do: 'Số hiệu tờ bản đồ',
  so_thu_tu_thua: 'Số thứ tự thửa',
  date_updated: 'Cập nhật lần cuối',
  water_station_type: 'Loại trạm',
  desc: 'Mô tả',
};

const TITLE_FIELD_CANDIDATES = [
  'ten',
  'name',
  'tenTram',
  'ten_tram',
  'maTram',
  'ma_tram',
  'ma',
  'code',
  'id',
];

function pickFirstMatchingField(
  properties: Record<string, unknown>,
  candidates: string[],
): string | null {
  for (const key of candidates) {
    const value = properties[key];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

export function pickFeatureTitle(
  properties: Record<string, unknown>,
): string | null {
  return pickFirstMatchingField(properties, TITLE_FIELD_CANDIDATES);
}

const WARD_FIELD_CANDIDATES = ['ten_xa', 'phuong_xa', 'ward', 'khu_vuc'];

export function pickFeatureWard(
  properties: Record<string, unknown>,
): string | null {
  return pickFirstMatchingField(properties, WARD_FIELD_CANDIDATES);
}

const GENDER_CODES: Record<string, 'male' | 'female'> = {
  '1': 'male',
  '0': 'female',
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

function humanizeKey(key: string): string {
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

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseIfJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== '[' && trimmed[0] !== '{')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function isArrayOfObjects(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}

function formatKeyedValue(
  key: string,
  value: unknown,
  labels: FieldLabels,
): string {
  if (key === 'gioi_tinh' && typeof value === 'string') {
    const gender = GENDER_CODES[value.trim()];
    if (gender) return gender === 'male' ? labels.male : labels.female;
  }
  return formatFieldValue(value, labels);
}

function formatFieldValue(value: unknown, labels: FieldLabels): string {
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

function normalizeObjectEntries(
  entry: Record<string, unknown>,
  labels: FieldLabels,
): NormalizedFeatureLeaf[] {
  return Object.entries(entry)
    .map(([key, value]) => [key, parseIfJson(value)] as const)
    .filter(([, value]) => !isEmpty(value))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABEL_OVERRIDES[key] ?? humanizeKey(key),
      value: formatKeyedValue(key, value, labels),
    }));
}

export function normalizeFeatureFields(
  properties: Record<string, unknown>,
  labels: FieldLabels,
): NormalizedFeatureField[] {
  return Object.entries(properties)
    .filter(([key]) => key !== 'geom')
    .map(([key, value]) => [key, parseIfJson(value)] as const)
    .filter(([, value]) => !isEmpty(value))
    .map(([key, value]) => {
      const label = FIELD_LABEL_OVERRIDES[key] ?? humanizeKey(key);
      if (isArrayOfObjects(value)) {
        return {
          kind: 'list',
          key,
          label,
          items: value.map(entry => normalizeObjectEntries(entry, labels)),
        };
      }
      if (isPlainObject(value)) {
        return {
          kind: 'list',
          key,
          label,
          items: [normalizeObjectEntries(value, labels)],
        };
      }
      return {
        kind: 'text',
        key,
        label,
        value: formatKeyedValue(key, value, labels),
      };
    });
}
