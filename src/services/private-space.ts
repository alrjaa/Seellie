import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';

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

function canUseCloud(userId: string) {
  return isSupabaseConfigured() && isUuid(userId);
}

async function loadLocal(userId: string): Promise<PrivateSpaceState> {
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

async function saveLocal(userId: string, state: PrivateSpaceState) {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
}

async function loadCloud(userId: string): Promise<PrivateSpaceState | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) return null;

  const [friendsRes, savedRes, messagesRes] = await Promise.all([
    sb
      .from('private_friends')
      .select('friend_id')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false }),
    sb
      .from('private_saved')
      .select('*')
      .eq('owner_id', userId)
      .order('saved_at', { ascending: false })
      .limit(200),
    sb
      .from('private_messages')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: true })
      .limit(1000),
  ]);

  // جدول غير موجود بعد → null ليرجع المحلي
  if (
    friendsRes.error?.message?.includes('schema cache') ||
    friendsRes.error?.code === '42P01' ||
    savedRes.error?.code === '42P01' ||
    messagesRes.error?.code === '42P01'
  ) {
    return null;
  }

  const friendIds = ((friendsRes.data || []) as { friend_id: string }[]).map(
    (r) => r.friend_id
  );

  const items: PrivateContentItem[] = (
    (savedRes.data || []) as Array<{
      id: string;
      kind: PrivateContentKind;
      media_url: string | null;
      title: string | null;
      body: string | null;
      author_id: string | null;
      author_name: string;
      author_handle: string | null;
      source_id: string;
      saved_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    kind: row.kind,
    mediaUrl: row.media_url || undefined,
    title: row.title || undefined,
    text: row.body || undefined,
    authorId: row.author_id || undefined,
    authorName: row.author_name || '',
    authorHandle: row.author_handle || undefined,
    sourceId: row.source_id,
    savedAt: row.saved_at,
  }));

  const chats: Record<string, PrivateChatMessage[]> = {};
  for (const row of (messagesRes.data || []) as Array<{
    id: string;
    friend_id: string;
    sender_id: string;
    body: string;
    created_at: string;
  }>) {
    const list = chats[row.friend_id] || [];
    list.push({
      id: row.id,
      fromMe: row.sender_id === userId,
      text: row.body,
      at: row.created_at,
    });
    chats[row.friend_id] = list;
  }

  return { friendIds, chats, items };
}

export async function loadPrivateSpace(
  userId: string
): Promise<PrivateSpaceState> {
  if (!userId) return emptyState();
  if (canUseCloud(userId)) {
    try {
      const cloud = await loadCloud(userId);
      if (cloud) {
        await saveLocal(userId, cloud);
        return cloud;
      }
    } catch (e) {
      console.warn('[private-space] cloud load failed', e);
    }
  }
  return loadLocal(userId);
}

export async function addPrivateFriend(
  userId: string,
  friendId: string
): Promise<PrivateSpaceState> {
  if (canUseCloud(userId) && isUuid(friendId)) {
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.from('private_friends').upsert(
        { owner_id: userId, friend_id: friendId },
        { onConflict: 'owner_id,friend_id' }
      );
      if (!error) return loadPrivateSpace(userId);
      console.warn('[private-space] add friend', error.message);
    }
  }
  const state = await loadLocal(userId);
  if (!state.friendIds.includes(friendId)) {
    state.friendIds = [friendId, ...state.friendIds];
    if (!state.chats[friendId]) state.chats[friendId] = [];
    await saveLocal(userId, state);
  }
  return state;
}

export async function removePrivateFriend(
  userId: string,
  friendId: string
): Promise<PrivateSpaceState> {
  if (canUseCloud(userId)) {
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb
        .from('private_friends')
        .delete()
        .eq('owner_id', userId)
        .eq('friend_id', friendId);
      if (!error) return loadPrivateSpace(userId);
      console.warn('[private-space] remove friend', error.message);
    }
  }
  const state = await loadLocal(userId);
  state.friendIds = state.friendIds.filter((id) => id !== friendId);
  await saveLocal(userId, state);
  return state;
}

export async function sendPrivateChatMessage(
  userId: string,
  friendId: string,
  text: string
): Promise<PrivateSpaceState> {
  const trimmed = text.trim();
  if (!trimmed) return loadPrivateSpace(userId);

  if (canUseCloud(userId) && isUuid(friendId)) {
    const sb = getSupabase();
    if (sb) {
      await sb
        .from('private_friends')
        .upsert(
          { owner_id: userId, friend_id: friendId },
          { onConflict: 'owner_id,friend_id' }
        );
      const { error } = await sb.from('private_messages').insert({
        owner_id: userId,
        friend_id: friendId,
        sender_id: userId,
        body: trimmed,
      });
      if (!error) return loadPrivateSpace(userId);
      console.warn('[private-space] send message', error.message);
    }
  }

  const state = await loadLocal(userId);
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
  await saveLocal(userId, state);
  return state;
}

export async function addPrivateContent(
  userId: string,
  item: Omit<PrivateContentItem, 'id' | 'savedAt'> & {
    id?: string;
    savedAt?: string;
  }
): Promise<{ state: PrivateSpaceState; added: boolean; error?: string }> {
  const sourceId = item.sourceId;
  if (!sourceId) {
    return { state: await loadPrivateSpace(userId), added: false, error: 'no_source' };
  }

  if (canUseCloud(userId)) {
    const sb = getSupabase();
    if (sb) {
      const { data: sessionData } = await sb.auth.getSession();
      if (sessionData.session) {
        const { data: existing } = await sb
          .from('private_saved')
          .select('id')
          .eq('owner_id', userId)
          .eq('source_id', sourceId)
          .maybeSingle();
        if (existing?.id) {
          return { state: await loadPrivateSpace(userId), added: false };
        }
        const { error } = await sb.from('private_saved').insert({
          owner_id: userId,
          source_id: sourceId,
          kind: item.kind,
          media_url: item.mediaUrl || null,
          title: item.title || null,
          body: item.text || null,
          author_id: item.authorId || null,
          author_name: item.authorName || '',
          author_handle: item.authorHandle || null,
        });
        if (!error) {
          return { state: await loadPrivateSpace(userId), added: true };
        }
        // إن لم تُنشأ الجداول بعد → سقوط للمحلي
        console.warn('[private-space] cloud save', error.message);
      }
    }
  }

  const state = await loadLocal(userId);
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
  await saveLocal(userId, state);
  return { state, added: true };
}

export async function removePrivateContent(
  userId: string,
  itemId: string
): Promise<PrivateSpaceState> {
  if (canUseCloud(userId) && isUuid(itemId)) {
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb
        .from('private_saved')
        .delete()
        .eq('owner_id', userId)
        .eq('id', itemId);
      if (!error) return loadPrivateSpace(userId);
      console.warn('[private-space] remove saved', error.message);
    }
  }
  const state = await loadLocal(userId);
  state.items = state.items.filter((x) => x.id !== itemId);
  await saveLocal(userId, state);
  return state;
}
