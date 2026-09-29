/**
 * Mock cho react-native-blob-util (module native) trong Jest: hệ thống file
 * giả trong bộ nhớ + các hàm mở tài liệu là jest.fn để test kiểm tra lời gọi.
 */
const files = new Map();
const dirs = new Set();

module.exports = {
  __esModule: true,
  default: {
    fs: {
      dirs: { CacheDir: '/cache', DocumentDir: '/documents' },
      isDir: jest.fn(async path => dirs.has(path)),
      mkdir: jest.fn(async path => {
        dirs.add(path);
      }),
      exists: jest.fn(async path => files.has(path)),
      unlink: jest.fn(async path => {
        files.delete(path);
      }),
      writeFile: jest.fn(async (path, data) => {
        files.set(path, data);
      }),
      readFile: jest.fn(async path => {
        if (!files.has(path)) throw new Error(`ENOENT: ${path}`);
        return files.get(path);
      }),
      __files: files,
    },
    MediaCollection: {
      copyToMediaStore: jest.fn(
        async fd => `content://media/external/downloads/${fd.name}`,
      ),
    },
    ios: { previewDocument: jest.fn(), openDocument: jest.fn(async () => {}) },
    android: { actionViewIntent: jest.fn(async () => true) },
  },
};
