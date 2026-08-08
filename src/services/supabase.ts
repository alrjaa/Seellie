import 'react-native-get-random-values';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

type SupabaseExtra = {
  url?: string;
  anonKey?: string;
};

function readConfig(): { url: string; anonKey: string } | null {
  const extra = (Constants.expoConfig?.extra?.supabase ?? {}) as SupabaseExtra;
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || extra.url?.trim() || '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    extra.anonKey?.trim() ||
    '';
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!readConfig();
}

export function getSupabase(): SupabaseClient | null {
  const config = readConfig();
  if (!config) return null;
  if (!client) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // على الويب فقط: قراءة ?code= / #access_token من رابط الاستعادة
        // على الموبايل نستهلك الرابط يدوياً عبر AuthDeepLinkHandler
        detectSessionInUrl: Platform.OS === 'web',
        // الويب: implicit حتى تعمل روابط «Send password recovery» من لوحة Supabase
        // (بدون code_verifier). الموبايل يبقى PKCE.
        flowType: Platform.OS === 'web' ? 'implicit' : 'pkce',
      },
    });
  }
  return client;
}
