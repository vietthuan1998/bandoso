import AsyncStorage from '@react-native-async-storage/async-storage';

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
