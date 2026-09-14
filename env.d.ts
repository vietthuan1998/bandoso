// Khai báo kiểu cho các biến môi trường được babel-plugin "react-native-dotenv"
// nạp từ file .env (xem babel.config.js). Thêm biến mới ở đây khi thêm vào .env.
declare module '@env' {
  export const MAP_TILE_AUTH_HOST_PATTERN: string | undefined;
  export const MAP_TILE_AUTH_HEADER: string | undefined;
  export const DCU_HOST_PATTERN: string | undefined;
  export const DCU_BEARER_TOKEN: string | undefined;
  export const API_BASE_URL: string | undefined;
  export const API_TIMEOUT: string | undefined;
}
