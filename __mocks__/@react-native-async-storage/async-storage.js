/**
 * Mock thủ công cho @react-native-async-storage/async-storage trong Jest.
 *
 * Bản build thật của gói này chỉ xuất bản dạng ESM (import/export) và cần
 * native module — không chạy được trong Jest. Viết lại tối giản, lưu trong
 * bộ nhớ (Map), đủ cho các API mà src/store/persistToken.ts dùng
 * (getItem/setItem/removeItem) mà không phải transform code ESM của gói qua
 * babel.
 */
let store = new Map();

module.exports = {
  getItem: jest.fn(async key => (store.has(key) ? store.get(key) : null)),
  setItem: jest.fn(async (key, value) => {
    store.set(key, value);
  }),
  removeItem: jest.fn(async key => {
    store.delete(key);
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(store.keys())),
};
