import { getJson, setJson } from '@/services/storage';

type CacheBox<T> = { expires: number; value: T };

export async function readSportsCache<T>(
  key: string
): Promise<T | null> {
  try {
    const box = await getJson<CacheBox<T>>(key);
    if (!box || typeof box.expires !== 'number') return null;
    if (Date.now() > box.expires) return null;
    return box.value;
  } catch {
    return null;
  }
}

export async function writeSportsCache<T>(
  key: string,
  value: T,
  ttlMs: number
): Promise<void> {
  try {
    await setJson(key, {
      expires: Date.now() + ttlMs,
      value,
    } satisfies CacheBox<T>);
  } catch {
    // تجاهل فشل التخزين — لا يؤثر على التدفق
  }
}
