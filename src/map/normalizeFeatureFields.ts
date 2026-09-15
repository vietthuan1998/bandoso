// Chuẩn hóa TOÀN BỘ thuộc tính (properties) của 1 đối tượng khi người dùng
// chọn trên bản đồ (hiện dùng cho MvtFeaturePanel — panel liệt kê tự do vì
// chưa có registry titleFields/detailFields thật từ backend, xem mục 11.3).
// Khác với getLocalizedDataValue (đọc theo 1 danh sách field đã biết trước),
// hàm này xử lý key/value BẤT KỲ lấy thẳng từ tile MVT.

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export type FieldLabels = { yes: string; no: string; male: string; female: string };

// Nhãn tiếng Việt có dấu cho các key đã biết chắc chắn từ schema thật của
// Directus (kiểm chứng qua GET /items/thua_dat) — humanizeKey chỉ là suy
// đoán chung (không dấu) nên field nào biết trước tên đẹp thì override ở
// đây. Áp dụng cho cả field top-level lẫn field con trong "chu_so_huu".
const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  // Field con của "chu_so_huu" (chủ sở hữu thửa đất)
  ho_ten: 'Họ tên',
  dia_chi: 'Địa chỉ',
  gioi_tinh: 'Giới tính',
  giay_to_tuy_than: 'Số giấy tờ tùy thân',
  // Field top-level của thua_dat
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
  // Field con của "water_station_type" (trạm mực nước, vd. {desc: "Tháp báo
  // lũ", name: "flood_3m"}) — không override thì rơi vào JSON.stringify thô
  // (xem formatFieldValue) vì đây là 1 object đơn, không phải mảng.
  water_station_type: 'Loại trạm',
  desc: 'Mô tả',
};

// Field hay dùng làm tiêu đề đối tượng theo mục 11.3 của đặc tả
// ("titleFields", sau đó fallback name/ten/code/id) — chưa có
// registry/titleFields thật từ backend nên đoán bằng danh sách khoá phổ biến
// này. Dùng chung cho MvtFeaturePanel (popup nhỏ trên bản đồ) và
// FeatureDetailScreen (trang chi tiết toàn màn hình) để tiêu đề nhất quán.
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

// Field hay dùng làm tên phường/xã của 1 đối tượng — cùng cách tiếp cận
// "danh sách khoá ứng viên" như TITLE_FIELD_CANDIDATES ở trên, để DataScreen
// (tab "Dữ liệu") đọc được phường/xã của MỌI collection qua 1 hàm chung, thay
// vì switch/case riêng cho từng collection. Chỉ `thua_dat.ten_xa` là field
// text đáng tin cậy thật (xem ghi chú đầu map/statisticsOverview.ts) — các
// khoá còn lại là dự phòng, không có collection nào đang dùng thật.
const WARD_FIELD_CANDIDATES = ['ten_xa', 'phuong_xa', 'ward', 'khu_vuc'];

export function pickFeatureWard(
  properties: Record<string, unknown>,
): string | null {
  return pickFirstMatchingField(properties, WARD_FIELD_CANDIDATES);
}

// gioi_tinh trong "chu_so_huu" là mã chuỗi "0"/"1", không phải boolean.
const GENDER_CODES: Record<string, 'male' | 'female'> = {
  '1': 'male',
  '0': 'female',
};

/** 1 dòng key/value đã chuẩn hóa, dùng cho field đơn hoặc cho từng item trong field dạng danh sách. */
export type NormalizedFeatureLeaf = {
  /** Key gốc trong properties, dùng làm React key. */
  key: string;
  /** Nhãn hiển thị, sinh từ key kỹ thuật (vd. "ten_tram" -> "Ten Tram"). */
  label: string;
  /** Giá trị đã định dạng theo kiểu dữ liệu, sẵn sàng để render. */
  value: string;
};

export type NormalizedFeatureField =
  | ({ kind: 'text' } & NormalizedFeatureLeaf)
  | {
      /** Field là mảng object (vd. "chu_so_huu" gồm nhiều đồng sở hữu) —
       * mỗi phần tử được chuẩn hóa thành 1 danh sách leaf riêng thay vì
       * gộp thành 1 chuỗi JSON khó đọc. */
      kind: 'list';
      key: string;
      label: string;
      items: NormalizedFeatureLeaf[][];
    };

/** Dùng chung cho mọi nơi cần định dạng giờ/ngày 2 chữ số (vd. "05" thay "5"). */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "ten_tram" / "tenTram" -> "Ten Tram" — tách từ theo snake_case và camelCase. */
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

/** Chuỗi ISO date/timestamp (Directus) -> dd/mm/yyyy; giữ nguyên nếu parse lỗi. */
function formatIsoDate(raw: string): string {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
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

// Tile MVT (protobuf) chỉ hỗ trợ giá trị thuộc tính kiểu scalar (string/
// number/boolean) — field gốc là mảng/object (vd. "chu_so_huu") bị server
// serialize thành 1 CHUỖI JSON khi đóng gói vào tile. Phải parse lại ở đây
// thì mới nhận diện được là mảng object để hiển thị có cấu trúc, thay vì in
// nguyên văn chuỗi JSON ra màn hình.
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

/** Mảng gồm toàn object thuần (vd. chu_so_huu: [{ten, cccd, diaChi}, ...]). */
function isArrayOfObjects(
  value: unknown,
): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}

/** Định dạng value có tính đến ý nghĩa riêng của 1 số key đã biết (vd.
 * gioi_tinh là mã "0"/"1", không phải chuỗi hiển thị trực tiếp được). */
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
    return Number.isFinite(value) ? value.toLocaleString('vi-VN') : String(value);
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

/** Chuẩn hóa 1 object con thành danh sách leaf (dùng cho từng phần tử của field dạng mảng object). */
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

/**
 * Chuẩn hóa toàn bộ properties của đối tượng đang chọn trên bản đồ:
 * - Bỏ field rỗng (null/undefined/'' /NaN/mảng rỗng).
 * - Sinh label dễ đọc từ key kỹ thuật.
 * - Định dạng value theo kiểu dữ liệu: số có dấu phân cách hàng nghìn,
 *   boolean -> có/không (i18n), chuỗi ISO date -> dd/mm/yyyy, mảng nguyên
 *   thủy -> nối chuỗi.
 * - Field dạng mảng object (vd. "chu_so_huu" nhiều đồng sở hữu) HOẶC 1 object
 *   đơn (vd. "water_station_type": {desc, name} của water_level_station) ->
 *   `kind: 'list'`, mỗi phần tử/chính object đó được chuẩn hóa thành danh
 *   sách leaf riêng để UI hiển thị từng mục rõ ràng thay vì 1 chuỗi JSON thô
 *   (trước đây object đơn bị formatFieldValue in nguyên văn JSON.stringify).
 */
export function normalizeFeatureFields(
  properties: Record<string, unknown>,
  labels: FieldLabels,
): NormalizedFeatureField[] {
  return Object.entries(properties)
    // "geom" là field kỹ thuật (toạ độ thô đi kèm bản ghi Directus khi lấy
    // qua fetchRecordById) — không phải thuộc tính nghiệp vụ nên không hiển
    // thị trong bảng chi tiết ở bất kỳ màn hình nào dùng hàm này.
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
      return { kind: 'text', key, label, value: formatKeyedValue(key, value, labels) };
    });
}
