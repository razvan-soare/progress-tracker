import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const SECURE_STORE_KEY_PREFIX = "progress-tracker-";

/**
 * Custom storage adapter for Supabase Auth that uses expo-secure-store
 * for secure token persistence on mobile devices.
 *
 * On web, falls back to localStorage since SecureStore is not available.
 */
export const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        return localStorage.getItem(key);
      }
      return null;
    }
    try {
      return await SecureStore.getItemAsync(`${SECURE_STORE_KEY_PREFIX}${key}`);
    } catch (error) {
      console.error("SecureStore getItem error:", error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, value);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(
        `${SECURE_STORE_KEY_PREFIX}${key}`,
        value
      );
    } catch (error) {
      console.error("SecureStore setItem error:", error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(`${SECURE_STORE_KEY_PREFIX}${key}`);
    } catch (error) {
      console.error("SecureStore removeItem error:", error);
    }
  },
};
