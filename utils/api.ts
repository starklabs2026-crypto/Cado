
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { BEARER_TOKEN_KEY } from "@/lib/auth";

export const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || "";

export const isBackendConfigured = (): boolean => {
  return !!BACKEND_URL && BACKEND_URL.length > 0;
};

export const getBearerToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(BEARER_TOKEN_KEY);
    } else {
      return await SecureStore.getItemAsync(BEARER_TOKEN_KEY);
    }
  } catch (error) {
    console.error("[API] Error retrieving bearer token:", error);
    return null;
  }
};

const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 15000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isSSLError = (error: any): boolean => {
  if (!error) return false;
  
  const errorString = error.toString().toLowerCase();
  const messageString = error.message?.toLowerCase() || '';
  
  return (
    errorString.includes('ssl') ||
    errorString.includes('tls') ||
    errorString.includes('certificate') ||
    errorString.includes('handshake') ||
    errorString.includes('cert') ||
    errorString.includes('secure connection') ||
    errorString.includes('nsurlsession') ||
    errorString.includes('nserror') ||
    errorString.includes('cfnetwork') ||
    errorString.includes('kcfstreamerrordomain') ||
    errorString.includes('nsurlconnection') ||
    errorString.includes('nsurlsessiontask') ||
    errorString.includes('ssl_error') ||
    errorString.includes('err_ssl') ||
    errorString.includes('ssl_protocol_error') ||
    messageString.includes('ssl') ||
    messageString.includes('tls') ||
    messageString.includes('certificate') ||
    messageString.includes('handshake') ||
    messageString.includes('cert') ||
    messageString.includes('secure connection') ||
    messageString.includes('nsurlsession') ||
    messageString.includes('nserror') ||
    messageString.includes('cfnetwork') ||
    messageString.includes('kcfstreamerrordomain') ||
    messageString.includes('nsurlconnection') ||
    messageString.includes('nsurlsessiontask') ||
    messageString.includes('ssl_error') ||
    messageString.includes('err_ssl') ||
    messageString.includes('ssl_protocol_error')
  );
};

const isNetworkError = (error: any): boolean => {
  if (!error) return false;
  
  const errorString = error.toString().toLowerCase();
  const messageString = error.message?.toLowerCase() || '';
  
  return (
    error instanceof TypeError ||
    errorString.includes('network request failed') ||
    errorString.includes('failed to fetch') ||
    errorString.includes('network error') ||
    errorString.includes('connection') ||
    errorString.includes('timeout') ||
    errorString.includes('unreachable') ||
    errorString.includes('econnrefused') ||
    errorString.includes('enotfound') ||
    errorString.includes('etimedout') ||
    messageString.includes('network request failed') ||
    messageString.includes('failed to fetch') ||
    messageString.includes('network error') ||
    messageString.includes('connection') ||
    messageString.includes('timeout') ||
    messageString.includes('unreachable') ||
    messageString.includes('econnrefused') ||
    messageString.includes('enotfound') ||
    messageString.includes('etimedout')
  );
};

const calculateRetryDelay = (retryCount: number): number => {
  const exponentialDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY);
};

export const apiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit,
  retryCount = 0
): Promise<T> => {
  if (!isBackendConfigured()) {
    throw new Error("Backend URL not configured. Please rebuild the app.");
  }

  const url = `${BACKEND_URL}${endpoint}`;
  console.log(`[API] Calling: ${url} ${options?.method || "GET"} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);

  try {
    const isFormData = options?.body instanceof FormData;
    
    const fetchOptions: RequestInit = {
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...options?.headers,
      },
    };

    if (Platform.OS === 'ios') {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'User-Agent': 'Calo-iOS/1.0',
      };
    }

    const token = await getBearerToken();
    if (token) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        Authorization: `Bearer ${token}`,
      };
    }

    const timeoutDuration = Platform.OS === 'ios' ? 60000 : 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorText = "";
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = "Unable to read error response";
        }
        
        console.error("[API] Error response:", response.status, errorText);
        
        if (response.status === 404) {
          throw new Error(`The requested feature is not available yet. Please try again later.`);
        } else if (response.status === 401) {
          throw new Error(`Authentication required. Please sign in again.`);
        } else if (response.status === 403) {
          throw new Error(`Access denied. You don't have permission to perform this action.`);
        } else if (response.status === 429) {
          if (retryCount < MAX_RETRIES) {
            const retryDelay = calculateRetryDelay(retryCount);
            console.log(`[API] Rate limited, retrying in ${retryDelay}ms...`);
            await delay(retryDelay);
            return apiCall<T>(endpoint, options, retryCount + 1);
          }
          throw new Error(`Too many requests. Please wait a moment and try again.`);
        } else if (response.status >= 520 && response.status <= 527) {
          if (retryCount < MAX_RETRIES) {
            const retryDelay = calculateRetryDelay(retryCount);
            console.log(`[API] Cloudflare/SSL error (${response.status}), retrying in ${retryDelay}ms...`);
            await delay(retryDelay);
            return apiCall<T>(endpoint, options, retryCount + 1);
          }
          throw new Error(`Connection error. Please check your internet connection and try again.`);
        } else if (response.status >= 500) {
          if (retryCount < MAX_RETRIES) {
            const retryDelay = calculateRetryDelay(retryCount);
            console.log(`[API] Server error (${response.status}), retrying in ${retryDelay}ms...`);
            await delay(retryDelay);
            return apiCall<T>(endpoint, options, retryCount + 1);
          }
          throw new Error(`Server error. Please try again later.`);
        } else {
          throw new Error(`Request failed: ${errorText || 'Unknown error'}`);
        }
      }

      const data = await response.json();
      console.log("[API] Success:", data);
      return data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error("[API] Request failed:", error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      if (retryCount < MAX_RETRIES) {
        const retryDelay = calculateRetryDelay(retryCount);
        console.log(`[API] Request timeout, retrying in ${retryDelay}ms...`);
        await delay(retryDelay);
        return apiCall<T>(endpoint, options, retryCount + 1);
      }
      throw new Error("Request timed out. Please check your internet connection and try again.");
    }
    
    if (isSSLError(error)) {
      if (retryCount < MAX_RETRIES) {
        const retryDelay = calculateRetryDelay(retryCount);
        console.log(`[API] SSL/TLS error detected (attempt ${retryCount + 1}/${MAX_RETRIES + 1}), retrying in ${retryDelay}ms...`);
        console.log(`[API] SSL Error details:`, error);
        await delay(retryDelay);
        return apiCall<T>(endpoint, options, retryCount + 1);
      }
      
      throw new Error("Connection security error. Please restart the app and try again. If the problem persists, check your network settings or try a different network.");
    }
    
    if (isNetworkError(error)) {
      if (retryCount < MAX_RETRIES) {
        const retryDelay = calculateRetryDelay(retryCount);
        console.log(`[API] Network error (attempt ${retryCount + 1}/${MAX_RETRIES + 1}), retrying in ${retryDelay}ms...`);
        await delay(retryDelay);
        return apiCall<T>(endpoint, options, retryCount + 1);
      }
      
      throw new Error("Unable to connect to server. Please check your internet connection and try again.");
    }
    
    throw error;
  }
};

export const apiGet = async <T = any>(endpoint: string): Promise<T> => {
  return apiCall<T>(endpoint, { method: "GET" });
};

export const apiPost = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const apiPut = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const apiPatch = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const apiDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return apiCall<T>(endpoint, {
    method: "DELETE",
    body: JSON.stringify(data),
  });
};

export const authenticatedApiCall = async <T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> => {
  const token = await getBearerToken();

  if (!token) {
    throw new Error("Authentication token not found. Please sign in.");
  }

  return apiCall<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
};

export const authenticatedGet = async <T = any>(endpoint: string): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, { method: "GET" });
};

export const authenticatedPost = async <T = any>(
  endpoint: string,
  data: any,
  options?: { headers?: Record<string, string> }
): Promise<T> => {
  const isFormData = data instanceof FormData;
  
  const fetchOptions: RequestInit = {
    method: "POST",
    body: isFormData ? data : JSON.stringify(data),
  };

  if (!isFormData) {
    fetchOptions.headers = {
      "Content-Type": "application/json",
      ...options?.headers,
    };
  } else if (options?.headers) {
    const { "Content-Type": _, ...otherHeaders } = options.headers;
    fetchOptions.headers = otherHeaders;
  }

  return authenticatedApiCall<T>(endpoint, fetchOptions);
};

export const authenticatedPut = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

export const authenticatedPatch = async <T = any>(
  endpoint: string,
  data: any
): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
};

export const authenticatedDelete = async <T = any>(endpoint: string, data: any = {}): Promise<T> => {
  return authenticatedApiCall<T>(endpoint, {
    method: "DELETE",
    body: JSON.stringify(data),
  });
};
