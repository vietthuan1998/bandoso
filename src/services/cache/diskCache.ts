import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';

/**
 * Cache xuống đĩa theo registryVersion (tài liệu mục 11): cùng version thì
 * dùng bản đã lưu, không gọi mạng; version đổi (hoặc chưa biết) thì tải lại;
 * mất mạng thì trả bản đã lưu (bất kể version) và đánh dấu `stale`.
 *
 * - storage 'kv': dữ liệu nhỏ (danh mục) lưu thẳng trong AsyncStorage.
 * - storage 'file': dữ liệu lớn (GeoJSON ranh giới ~4 MB) lưu thành file —
 *   AsyncStorage trên Android mặc định chỉ có ~6 MB cho toàn bộ app.
 */
export type CacheStorage = 'kv' | 'file';

export type CachedResult<T> = {
  data: T;
  /** Lấy từ bản đã lưu (không gọi mạng hoặc gọi mạng thất bại). */
  fromCache: boolean;
  /** Mạng lỗi nên đang dùng bản đã lưu — có thể đã cũ. */
  stale: boolean;
  /** Lần tải thành công gần nhất từ server (ISO 8601). */
  syncedAt: string;
};

type Meta = { version: string | null; syncedAt: string };
type KvEntry<T> = Meta & { data: T };

const KEY_PREFIX = '@huemaps/cache/';
const CACHE_DIR = `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/huemaps-cache`;

function filePath(key: string): string {
  return `${CACHE_DIR}/${key}.json`;
}

async function readEntry<T>(
  key: string,
  storage: CacheStorage,
): Promise<KvEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    if (storage === 'kv') return JSON.parse(raw) as KvEntry<T>;
    const meta = JSON.parse(raw) as Meta;
    const path = filePath(key);
    if (!(await ReactNativeBlobUtil.fs.exists(path))) return null;
    const text = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
    return { ...meta, data: JSON.parse(text) as T };
  } catch {
    return null;
  }
}

async function writeEntry<T>(
  key: string,
  storage: CacheStorage,
  entry: KvEntry<T>,
): Promise<void> {
  try {
    if (storage === 'kv') {
      await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry));
      return;
    }
    if (!(await ReactNativeBlobUtil.fs.isDir(CACHE_DIR))) {
      await ReactNativeBlobUtil.fs.mkdir(CACHE_DIR);
    }
    await ReactNativeBlobUtil.fs.writeFile(
      filePath(key),
      JSON.stringify(entry.data),
      'utf8',
    );
    const meta: Meta = { version: entry.version, syncedAt: entry.syncedAt };
    await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(meta));
  } catch {
    // Ghi cache lỗi (đầy bộ nhớ...) không được chặn dữ liệu vừa tải.
  }
}

export async function cachedFetch<T>({
  key,
  version,
  load,
  storage = 'kv',
}: {
  key: string;
  /** registryVersion hiện tại; null = chưa biết -> luôn thử tải mới. */
  version: string | null;
  load: () => Promise<T>;
  storage?: CacheStorage;
}): Promise<CachedResult<T>> {
  const cached = await readEntry<T>(key, storage);
  if (cached && version !== null && cached.version === version) {
    return {
      data: cached.data,
      fromCache: true,
      stale: false,
      syncedAt: cached.syncedAt,
    };
  }
  try {
    const data = await load();
    const syncedAt = new Date().toISOString();
    await writeEntry(key, storage, { version, syncedAt, data });
    return { data, fromCache: false, stale: false, syncedAt };
  } catch (error) {
    if (!cached) throw error;
    return {
      data: cached.data,
      fromCache: true,
      stale: true,
      syncedAt: cached.syncedAt,
    };
  }
}
