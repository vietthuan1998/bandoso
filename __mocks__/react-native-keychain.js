/**
 * Mock thủ công cho react-native-keychain trong Jest.
 *
 * Thư viện dùng native module thật (Keychain iOS / Keystore Android) nên
 * không chạy được trong Jest. Lưu trong bộ nhớ (Map theo service), đủ cho
 * API mà src/auth/authClient.ts dùng (setGenericPassword/getGenericPassword/
 * resetGenericPassword).
 */
let store = new Map();

module.exports = {
  setGenericPassword: jest.fn(async (username, password, options) => {
    const service = options?.service ?? 'default';
    store.set(service, { username, password });
    return { service, storage: 'mock' };
  }),
  getGenericPassword: jest.fn(async options => {
    const service = options?.service ?? 'default';
    return store.has(service) ? { ...store.get(service), service } : false;
  }),
  resetGenericPassword: jest.fn(async options => {
    const service = options?.service ?? 'default';
    store.delete(service);
    return true;
  }),
  __reset: () => store.clear(),
};
