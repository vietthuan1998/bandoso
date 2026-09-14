module.exports = {
  preset: '@react-native/jest-preset',
  // @maplibre/maplibre-react-native xuất bản kèm vài file *NativeComponent.ts
  // (spec codegen) chưa biên dịch sẵn trong lib/commonjs — Jest cần transform
  // qua babel như code nguồn, nên phải mở rộng transformIgnorePatterns mặc
  // định của @react-native/jest-preset (vốn chỉ cho qua react-native/@react-native).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@maplibre/maplibre-react-native)/)',
  ],
};
