module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        // Cho phép thiếu biến khi build (ví dụ máy dev chưa điền token) thay vì
        // báo lỗi cứng — code đọc giá trị này phải tự kiểm tra rỗng/undefined.
        allowUndefined: true,
      },
    ],
  ],
};
