import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PrivateChatMessage, PrivateSpaceState } from './private-space';

export type PrivateReadState = Record<string, string>;

const KEY_PREFIX = 'seellie.privateRead.v1.';

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export async function loadPrivateReadState(
  userId: string
): Promise<PrivateReadState> {
  if (!userId) return {};
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PrivateReadState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function savePrivateReadState(
  userId: string,
  state: PrivateReadState
) {
  if (!userId) return;
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function computeThreadUnreadCount(
  messages: PrivateChatMessage[],
  lastReadAt?: string
): number {
  const cutoff = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return messages.filter(
    (m) => !m.fromMe && new Date(m.at).getTime() > cutoff
  ).length;
}

export function computePrivateUnreadCount(
  space: PrivateSpaceState,
  readState: PrivateReadState
): number {
  let total = 0;
  for (const friendId of Object.keys(space.chats)) {
    total += computeThreadUnreadCount(
      space.chats[friendId] || [],
      readState[friendId]
    );
  }
  return total;
}

export function isIncomingMessageUnread(
  msg: PrivateChatMessage,
  lastReadAt?: string
): boolean {
  if (msg.fromMe) return false;
  const cutoff = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return new Date(msg.at).getTime() > cutoff;
}

/** آخر طابع زمني في المحادثة — يُستخدم عند تعليمها مقروءة. */
export function readTimestampForThread(
  messages: PrivateChatMessage[]
): string {
  if (!messages.length) return new Date().toISOString();
  return messages[messages.length - 1].at;
}
