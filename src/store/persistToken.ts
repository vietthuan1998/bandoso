import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Lưu trữ access token của người dùng (khác với các token tĩnh trong .env
 * dùng cho tile bản đồ — xem src/config/mapTileAuth.ts). App hiện chưa có
 * màn hình đăng nhập, module này chuẩn bị sẵn cho tính năng đó: getToken
 * dùng trong interceptor của httpClient.ts, setToken/clearToken gọi khi
 * đăng nhập/đăng xuất.
 */
const TOKEN_KEY = '@huemaps/auth_token';

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    // Không chặn request nếu đọc storage lỗi — coi như chưa có token.
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
