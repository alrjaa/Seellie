import AsyncStorage from '@react-native-async-storage/async-storage';

export type PrivateContentKind = 'photo' | 'video' | 'text';

export type PrivateContentItem = {
  id: string;
  kind: PrivateContentKind;
  mediaUrl?: string;
  title?: string;
  text?: string;
  authorId?: string;
  authorName: string;
  authorHandle?: string;
  sourceId: string;
  savedAt: string;
};

export type PrivateChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  at: string;
};

export type PrivateSpaceState = {
  friendIds: string[];
  /** رسائل خاصة لكل صديق */
  chats: Record<string, PrivateChatMessage[]>;
  items: PrivateContentItem[];
};

const emptyState = (): PrivateSpaceState => ({
  friendIds: [],
  chats: {},
  items: [],
});

function storageKey(userId: string) {
  return `seellie.privateSpace.v1.${userId}`;
}

export async function loadPrivateSpace(
  userId: string
): Promise<PrivateSpaceState> {
  if (!userId) return emptyState();
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PrivateSpaceState>;
    return {
      friendIds: Array.isArray(parsed.friendIds) ? parsed.friendIds : [],
      chats:
        parsed.chats && typeof parsed.chats === 'object' ? parsed.chats : {},
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return emptyState();
  }
}

export async function savePrivateSpace(
  userId: string,
  state: PrivateSpaceState
): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export async function addPrivateFriend(
  userId: string,
  friendId: string
): Promise<PrivateSpaceState> {
  const state = await loadPrivateSpace(userId);
  if (!state.friendIds.includes(friendId)) {
    state.friendIds = [friendId, ...state.friendIds];
    if (!state.chats[friendId]) state.chats[friendId] = [];
    await savePrivateSpace(userId, state);
  }
  return state;
}

export async function removePrivateFriend(
  userId: string,
  friendId: string
): Promise<PrivateSpaceState> {
  const state = await loadPrivateSpace(userId);
  state.friendIds = state.friendIds.filter((id) => id !== friendId);
  await savePrivateSpace(userId, state);
  return state;
}

export async function sendPrivateChatMessage(
  userId: string,
  friendId: string,
  text: string
): Promise<PrivateSpaceState> {
  const trimmed = text.trim();
  if (!trimmed) return loadPrivateSpace(userId);
  const state = await loadPrivateSpace(userId);
  if (!state.friendIds.includes(friendId)) {
    state.friendIds = [friendId, ...state.friendIds];
  }
  const list = state.chats[friendId] ? [...state.chats[friendId]] : [];
  list.push({
    id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fromMe: true,
    text: trimmed,
    at: new Date().toISOString(),
  });
  state.chats[friendId] = list;
  await savePrivateSpace(userId, state);
  return state;
}

export async function addPrivateContent(
  userId: string,
  item: Omit<PrivateContentItem, 'id' | 'savedAt'> & {
    id?: string;
    savedAt?: string;
  }
): Promise<{ state: PrivateSpaceState; added: boolean }> {
  const state = await loadPrivateSpace(userId);
  const sourceId = item.sourceId;
  if (state.items.some((x) => x.sourceId === sourceId)) {
    return { state, added: false };
  }
  const next: PrivateContentItem = {
    id: item.id || `pc-${Date.now()}`,
    kind: item.kind,
    mediaUrl: item.mediaUrl,
    title: item.title,
    text: item.text,
    authorId: item.authorId,
    authorName: item.authorName,
    authorHandle: item.authorHandle,
    sourceId,
    savedAt: item.savedAt || new Date().toISOString(),
  };
  state.items = [next, ...state.items].slice(0, 200);
  await savePrivateSpace(userId, state);
  return { state, added: true };
}

export async function removePrivateContent(
  userId: string,
  itemId: string
): Promise<PrivateSpaceState> {
  const state = await loadPrivateSpace(userId);
  state.items = state.items.filter((x) => x.id !== itemId);
  await savePrivateSpace(userId, state);
  return state;
}
