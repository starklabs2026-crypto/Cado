
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:3000';

const MAX_RETRIES = 10;
const INITIAL_RETRY_DELAY_MS = 1000;
const IOS_TIMEOUT_MS = 60000;
const ANDROID_TIMEOUT_MS = 30000;

async function authenticatedApiCall<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  data?: any,
  options?: RequestInit
): Promise<T | null> {
  const token = await SecureStore.getItemAsync('auth_token');
  if (!token) {
    console.log('[API] No auth token found, skipping authenticated request to', endpoint);
    return null;
  }

  const fullUrl = `${BACKEND_URL}${endpoint}`;
  const timeout = Platform.OS === 'ios' ? IOS_TIMEOUT_MS : ANDROID_TIMEOUT_MS;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'User-Agent': `Calo-${Platform.OS === 'ios' ? 'iOS' : 'Android'}/1.0`,
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (method !== 'GET' && method !== 'DELETE' && data !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`[API] Calling: ${fullUrl} ${method} (attempt ${attempt + 1}/${MAX_RETRIES})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(fullUrl, {
        method,
        headers,
        body: data !== undefined && method !== 'GET' && method !== 'DELETE' ? JSON.stringify(data) : undefined,
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (response.status >= 520 && response.status <= 527) {
        throw new Error(`Cloudflare error: ${response.status}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] Error response (${response.status}):`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[API] Success:', result);
      return result as T;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      console.error(`[API] Attempt ${attempt + 1} failed:`, errorMessage);

      const isRetryableError =
        errorMessage.includes('SSL') ||
        errorMessage.includes('TLS') ||
        errorMessage.includes('certificate') ||
        errorMessage.includes('kCFStreamErrorDomain') ||
        errorMessage.includes('NSURLSession') ||
        errorMessage.includes('CFNetwork') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('Cloudflare error') ||
        errorMessage.includes('aborted');

      if (isRetryableError && attempt < MAX_RETRIES - 1) {
        const delay = Math.min(
          INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500,
          15000
        );
        console.log(`[API] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('[API] All retry attempts failed');
      return null;
    }
  }

  return null;
}

export const authenticatedGet = <T>(endpoint: string, options?: RequestInit): Promise<T | null> =>
  authenticatedApiCall<T>('GET', endpoint, undefined, options);

export const authenticatedPost = <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T | null> =>
  authenticatedApiCall<T>('POST', endpoint, data, options);

export const authenticatedPut = <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T | null> =>
  authenticatedApiCall<T>('PUT', endpoint, data, options);

export const authenticatedPatch = <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T | null> =>
  authenticatedApiCall<T>('PATCH', endpoint, data, options);

export const authenticatedDelete = <T>(endpoint: string, options?: RequestInit): Promise<T | null> =>
  authenticatedApiCall<T>('DELETE', endpoint, undefined, options);

async function publicApiCall<T>(
  method: 'GET' | 'POST',
  endpoint: string,
  data?: any,
  options?: RequestInit
): Promise<T | null> {
  const fullUrl = `${BACKEND_URL}${endpoint}`;
  const timeout = Platform.OS === 'ios' ? IOS_TIMEOUT_MS : ANDROID_TIMEOUT_MS;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': `Calo-${Platform.OS === 'ios' ? 'iOS' : 'Android'}/1.0`,
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    ...(options?.headers as Record<string, string> || {}),
  };

  if (method === 'POST' && data !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`[API] Public call: ${fullUrl} ${method} (attempt ${attempt + 1}/${MAX_RETRIES})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(fullUrl, {
        method,
        headers,
        body: data !== undefined && method === 'POST' ? JSON.stringify(data) : undefined,
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

      if (response.status >= 520 && response.status <= 527) {
        throw new Error(`Cloudflare error: ${response.status}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API] Error response (${response.status}):`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[API] Success:', result);
      return result as T;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      console.error(`[API] Attempt ${attempt + 1} failed:`, errorMessage);

      const isRetryableError =
        errorMessage.includes('SSL') ||
        errorMessage.includes('TLS') ||
        errorMessage.includes('certificate') ||
        errorMessage.includes('Network request failed') ||
        errorMessage.includes('Cloudflare error') ||
        errorMessage.includes('aborted');

      if (isRetryableError && attempt < MAX_RETRIES - 1) {
        const delay = Math.min(
          INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500,
          15000
        );
        console.log(`[API] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('[API] All retry attempts failed');
      return null;
    }
  }

  return null;
}

export const apiGet = <T>(endpoint: string, options?: RequestInit): Promise<T | null> =>
  publicApiCall<T>('GET', endpoint, undefined, options);

export const apiPost = <T>(endpoint: string, data?: any, options?: RequestInit): Promise<T | null> =>
  publicApiCall<T>('POST', endpoint, data, options);
