import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  REPORT_MIME_TYPES,
  type ReportFile,
  type ReportFormat,
} from './reportApi';

/** Thư mục con trong Tải xuống (Android) / Tệp của app (iOS). */
export const REPORT_FOLDER = 'HueMaps';

export type SavedReport = {
  filename: string;
  /** Đường dẫn/URI hệ thống dùng để mở file. */
  uri: string;
  mimeType: string;
};

export class ReportSaveError extends Error {
  constructor(
    public readonly reason: 'storagePermission' | 'saveFailed',
    cause?: unknown,
  ) {
    super(cause instanceof Error ? cause.message : reason);
    this.name = 'ReportSaveError';
  }
}

/**
 * MIME suy từ đuôi file thay vì tin Content-Type của server (có thể là
 * application/octet-stream) — hệ điều hành dựa vào MIME để tìm app mở phù hợp.
 */
export function mimeTypeForFile(filename: string, fallback: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() as ReportFormat;
  return REPORT_MIME_TYPES[extension] ?? fallback;
}

async function writeToCache(file: ReportFile): Promise<string> {
  const dir = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/reports`;
  if (!(await ReactNativeBlobUtil.fs.isDir(dir))) {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  }
  const path = `${dir}/${file.filename}`;
  if (await ReactNativeBlobUtil.fs.exists(path)) {
    await ReactNativeBlobUtil.fs.unlink(path);
  }
  await ReactNativeBlobUtil.fs.writeFile(path, file.base64, 'base64');
  return path;
}

/**
 * Lưu báo cáo vào nơi người dùng tự tìm lại được trên máy:
 * - Android: Tải xuống/HueMaps (MediaStore; Android 9 trở xuống cần quyền ghi).
 * - iOS: thư mục Documents của app — hiện trong app Tệp › Trên iPhone ›
 *   HueMaps (Info.plist bật UIFileSharingEnabled + LSSupportsOpeningDocumentsInPlace).
 */
export async function saveReportToDevice(
  file: ReportFile,
): Promise<SavedReport> {
  const mimeType = mimeTypeForFile(file.filename, file.mimeType);

  if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new ReportSaveError('storagePermission');
    }
  }

  try {
    if (Platform.OS === 'android') {
      const cachePath = await writeToCache(file);
      // Native đọc các khoá name / parentFolder / mimeType (kiểu .d.ts của
      // thư viện ghi sai là "path").
      const uri = await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
        { name: file.filename, parentFolder: REPORT_FOLDER, mimeType } as never,
        'Download',
        cachePath,
      );
      await ReactNativeBlobUtil.fs.unlink(cachePath).catch(() => {});
      return { filename: file.filename, uri, mimeType };
    }

    const dir = ReactNativeBlobUtil.fs.dirs.DocumentDir;
    const path = `${dir}/${file.filename}`;
    if (await ReactNativeBlobUtil.fs.exists(path)) {
      await ReactNativeBlobUtil.fs.unlink(path);
    }
    await ReactNativeBlobUtil.fs.writeFile(path, file.base64, 'base64');
    return { filename: file.filename, uri: path, mimeType };
  } catch (error) {
    throw new ReportSaveError('saveFailed', error);
  }
}

/**
 * Giao file cho hệ điều hành mở, không ép app cụ thể:
 * - Android: ACTION_VIEW không kèm hộp chọn riêng — hệ thống dùng app mặc
 *   định hoặc tự hiện hộp "Mở bằng" của nó.
 * - iOS: trình xem Quick Look của hệ thống (có sẵn nút chia sẻ / mở bằng app khác).
 * Trả về false nếu máy không có app nào mở được loại file này.
 */
export async function openSavedReport(saved: SavedReport): Promise<boolean> {
  if (Platform.OS === 'ios') {
    ReactNativeBlobUtil.ios.previewDocument(saved.uri);
    return true;
  }
  try {
    await ReactNativeBlobUtil.android.actionViewIntent(
      saved.uri,
      saved.mimeType,
    );
    return true;
  } catch (error) {
    // Chỉ ENOAPP mới là "máy không có app mở được"; lỗi khác báo đúng lỗi.
    if ((error as { code?: string } | null)?.code === 'ENOAPP') return false;
    throw error;
  }
}
