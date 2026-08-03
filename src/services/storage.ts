import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

/** Secure storage for small secrets only (falls back to AsyncStorage on web). */
export async function secureGet(key: string): Promise<string | null> {
  try {
    if (isWeb) return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.warn('secureSet failed', key, error);
  }
}

export async function secureRemove(key: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn('secureRemove failed', key, error);
  }
}

/**
 * JSON helpers use AsyncStorage (not SecureStore) so session/user payloads
 * are not limited by the ~2KB SecureStore cap on iOS.
 */
export async function getJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      // migrate legacy SecureStore sessions once
      const legacy = await secureGet(key);
      if (!legacy) return null;
      try {
        await AsyncStorage.setItem(key, legacy);
        await secureRemove(key);
      } catch {
        // ignore migration errors
      }
      try {
        return JSON.parse(legacy) as T;
      } catch {
        return null;
      }
    }
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('setJson failed', key, error);
  }
}

export async function removeJson(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
    await secureRemove(key);
  } catch (error) {
    console.warn('removeJson failed', key, error);
  }
}
