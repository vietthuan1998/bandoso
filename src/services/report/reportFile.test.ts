import { PermissionsAndroid, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  mimeTypeForFile,
  openSavedReport,
  ReportSaveError,
  saveReportToDevice,
} from './reportFile';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FILE = {
  filename: 'bao-cao.xlsx',
  // Server có thể trả MIME chung chung — không được dùng để tìm app mở.
  mimeType: 'application/octet-stream',
  base64: 'UEsDBBQ=',
};

function setPlatform(os: 'ios' | 'android', version = 34) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  Object.defineProperty(Platform, 'Version', { value: version, configurable: true });
}

describe('mimeTypeForFile', () => {
  it('derives the MIME from the extension, falling back to the server value', () => {
    expect(mimeTypeForFile('a.xlsx', 'application/octet-stream')).toBe(XLSX);
    expect(mimeTypeForFile('a.csv', 'x')).toBe('text/csv');
    expect(mimeTypeForFile('a.bin', 'application/octet-stream')).toBe(
      'application/octet-stream',
    );
  });
});

describe('saveReportToDevice', () => {
  const original = { os: Platform.OS, version: Platform.Version };
  afterEach(() => {
    setPlatform(original.os as 'ios' | 'android', Number(original.version));
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('Android 10+: copies the file into Downloads/HueMaps via MediaStore without asking for permission', async () => {
    setPlatform('android', 34);
    const request = jest.spyOn(PermissionsAndroid, 'request');

    const saved = await saveReportToDevice(FILE);

    expect(request).not.toHaveBeenCalled();
    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).toHaveBeenCalledWith(
      { name: 'bao-cao.xlsx', parentFolder: 'HueMaps', mimeType: XLSX },
      'Download',
      '/cache/reports/bao-cao.xlsx',
    );
    expect(saved).toEqual({
      filename: 'bao-cao.xlsx',
      uri: 'content://media/external/downloads/bao-cao.xlsx',
      mimeType: XLSX,
    });
  });

  it('Android 9 and older: needs the storage permission first', async () => {
    setPlatform('android', 28);
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    await expect(saveReportToDevice(FILE)).rejects.toMatchObject({
      reason: 'storagePermission',
    });
    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).not.toHaveBeenCalled();
  });

  it('iOS: writes into the app Documents folder (visible in the Files app)', async () => {
    setPlatform('ios');

    const saved = await saveReportToDevice(FILE);

    expect(ReactNativeBlobUtil.fs.writeFile).toHaveBeenCalledWith(
      '/documents/bao-cao.xlsx',
      'UEsDBBQ=',
      'base64',
    );
    expect(saved.uri).toBe('/documents/bao-cao.xlsx');
  });

  it('reports a real save failure instead of pretending the file was saved', async () => {
    setPlatform('ios');
    (ReactNativeBlobUtil.fs.writeFile as jest.Mock).mockRejectedValueOnce(
      new Error('disk full'),
    );

    const error = await saveReportToDevice(FILE).catch(e => e);

    expect(error).toBeInstanceOf(ReportSaveError);
    expect(error.reason).toBe('saveFailed');
  });
});

describe('openSavedReport', () => {
  const saved = { filename: 'bao-cao.xlsx', uri: 'content://x/bao-cao.xlsx', mimeType: XLSX };
  const originalOS = Platform.OS;
  afterEach(() => {
    setPlatform(originalOS as 'ios' | 'android');
    jest.clearAllMocks();
  });

  it('Android: lets the system pick the app (no forced chooser)', async () => {
    setPlatform('android');

    await expect(openSavedReport(saved)).resolves.toBe(true);
    expect(ReactNativeBlobUtil.android.actionViewIntent).toHaveBeenCalledWith(
      'content://x/bao-cao.xlsx',
      XLSX,
    );
  });

  it('Android: returns false only when no app can open the file (ENOAPP)', async () => {
    setPlatform('android');
    (ReactNativeBlobUtil.android.actionViewIntent as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('No app'), { code: 'ENOAPP' }),
    );
    await expect(openSavedReport(saved)).resolves.toBe(false);

    (ReactNativeBlobUtil.android.actionViewIntent as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'EUNSPECIFIED' }),
    );
    await expect(openSavedReport(saved)).rejects.toThrow('boom');
  });

  it('iOS: hands the file to the system Quick Look preview', async () => {
    setPlatform('ios');

    await expect(openSavedReport({ ...saved, uri: '/documents/bao-cao.xlsx' })).resolves.toBe(true);
    expect(ReactNativeBlobUtil.ios.previewDocument).toHaveBeenCalledWith(
      '/documents/bao-cao.xlsx',
    );
  });
});
