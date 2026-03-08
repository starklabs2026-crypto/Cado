
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";

const API_URL = Constants.expoConfig?.extra?.backendUrl || "";

export const BEARER_TOKEN_KEY = "calo_bearer_token";

// Platform-specific storage: localStorage for web, SecureStore for native
const storage = Platform.OS === "web"
  ? {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      deleteItem: (key: string) => localStorage.removeItem(key),
    }
  : {
      getItem: async (key: string) => await SecureStore.getItemAsync(key),
      setItem: async (key: string, value: string) => await SecureStore.setItemAsync(key, value),
      deleteItem: async (key: string) => await SecureStore.deleteItemAsync(key),
    };

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "calo",
      storagePrefix: "calo",
      storage,
    }),
  ],
  fetchOptions: {
    // On web, use cookies (credentials: include)
    ...(Platform.OS === "web" && {
      credentials: "include",
    }),
    // For iOS, add additional fetch options to help with SSL
    ...(Platform.OS === "ios" && {
      // Ensure we're using the correct headers
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    }),
    // Fallback to bearer token for all platforms
    auth: {
      type: "Bearer" as const,
      token: async () => {
        if (Platform.OS === "web") {
          return localStorage.getItem(BEARER_TOKEN_KEY) || "";
        } else {
          return await SecureStore.getItemAsync(BEARER_TOKEN_KEY) || "";
        }
      },
    },
  },
});

export async function setBearerToken(token: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(BEARER_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(BEARER_TOKEN_KEY, token);
  }
}

export async function clearAuthTokens() {
  if (Platform.OS === "web") {
    localStorage.removeItem(BEARER_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(BEARER_TOKEN_KEY);
  }
}

export { API_URL };
