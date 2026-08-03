/** معرّف عشوائي بدون crypto (متوافق مع Expo Go / Hermes) */
export function createId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}
