import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolvePublicMediaUrl } from '@/services/cloud-write';
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

export type PrivateChatMediaKind = 'photo' | 'video';

export type PrivateChatMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  at: string;
  mediaUrl?: string;
  mediaKind?: PrivateChatMediaKind;
};

export type PrivateChatMediaInput = {
  uri: string;
  kind: PrivateChatMediaKind;
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

  const friendIds = Array.from(
    new Set([
      ...((friendsRes.data || []) as { friend_id: string }[]).map(
        (r) => r.friend_id
      ),
    ])
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
    body: string | null;
    media_url?: string | null;
    media_kind?: string | null;
    created_at: string;
  }>) {
    let mediaUrl = row.media_url || undefined;
    let mediaKind: PrivateChatMediaKind | undefined =
      row.media_kind === 'photo' || row.media_kind === 'video'
        ? row.media_kind
        : undefined;

    // رسائل قديمة: الرابط داخل النص فقط
    if (!mediaUrl && row.body) {
      const legacy = row.body.trim().match(/^(?:🖼️|🎬)\s*(https?:\/\/\S+)/i);
      if (legacy?.[1]) {
        mediaUrl = legacy[1];
        mediaKind =
          row.body.trim().startsWith('🎬') ||
          /\.(?:mp4|mov|webm|m4v)(?:\?\S*)?$/i.test(legacy[1])
            ? 'video'
            : 'photo';
      }
    }

    if (mediaUrl && !mediaKind) {
      mediaKind = /\.(?:mp4|mov|webm|m4v)(?:\?\S*)?$/i.test(mediaUrl)
        ? 'video'
        : /\/(?:videos?|highlights|analysis)\//i.test(mediaUrl) ||
            (/video|mp4|webm|mov/i.test(mediaUrl) &&
              /supabase|storage|share-media/i.test(mediaUrl))
          ? 'video'
          : 'photo';
    }

    const list = chats[row.friend_id] || [];
    list.push({
      id: row.id,
      fromMe: row.sender_id === userId,
      text: row.body || '',
      at: row.created_at,
      mediaUrl,
      mediaKind: mediaUrl ? mediaKind : undefined,
    });
    chats[row.friend_id] = list;
    // رسالة واردة ⇒ أظهر المرسل في الأصدقاء حتى لو فشلت صداقة الاتجاه المعاكس
    if (!friendIds.includes(row.friend_id)) {
      friendIds.push(row.friend_id);
    }
  }

  return { friendIds, chats, items };
}

export async function loadPrivateSpace(
  userId: string
): Promise<PrivateSpaceState> {
  if (!userId) return emptyState();
  const local = await loadLocal(userId);
  if (canUseCloud(userId)) {
    try {
      let cloud = await loadCloud(userId);
      if (cloud) {
        // إن وُجد أصدقاء محلياً ولم يصلوا للسحابة — حاول رفعهم ثم أعد الجلب
        const missing = local.friendIds.filter(
          (id) => isUuid(id) && !cloud!.friendIds.includes(id)
        );
        if (missing.length) {
          const sb = getSupabase();
          if (sb) {
            for (const friendId of missing) {
              const { error: rpcError } = await sb.rpc('add_private_friend', {
                p_friend_id: friendId,
              });
              if (rpcError) {
                await sb.from('private_friends').upsert(
                  { owner_id: userId, friend_id: friendId },
                  { onConflict: 'owner_id,friend_id' }
                );
              }
            }
            cloud = (await loadCloud(userId)) || cloud;
          }
        }
        // دمج احتياطي: لا تمسح أصدقاء محليين إن السحابة فارغة جزئياً بعد فشل الرفع
        const friendIds = Array.from(
          new Set([...cloud.friendIds, ...local.friendIds])
        );
        const chats = { ...local.chats, ...cloud.chats };
        for (const id of friendIds) {
          const a = local.chats[id] || [];
          const b = cloud.chats[id] || [];
          if (a.length || b.length) {
            const byId = new Map<string, (typeof a)[number]>();
            [...a, ...b].forEach((m) => byId.set(m.id, m));
            chats[id] = Array.from(byId.values()).sort((x, y) =>
              x.at.localeCompare(y.at)
            );
          }
        }
        const itemsBySource = new Map(
          [...local.items, ...cloud.items].map((i) => [i.sourceId || i.id, i])
        );
        const merged: PrivateSpaceState = {
          friendIds,
          chats,
          items: Array.from(itemsBySource.values()).sort((a, b) =>
            b.savedAt.localeCompare(a.savedAt)
          ),
        };
        await saveLocal(userId, merged);
        return merged;
      }
    } catch (e) {
      console.warn('[private-space] cloud load failed', e);
    }
  }
  return local;
}

function parsePrivateRpcResult(data: unknown): {
  ok: boolean;
  error?: string;
} {
  let parsed: unknown = data;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { ok: false, error: 'bad_rpc_payload' };
    }
  }
  if (parsed === true) return { ok: true };
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as { ok?: boolean; error?: string };
    if (obj.ok === true) return { ok: true };
    return { ok: false, error: obj.error || 'rpc_failed' };
  }
  return { ok: false, error: 'rpc_failed' };
}

export async function addPrivateFriend(
  userId: string,
  friendId: string
): Promise<{ state: PrivateSpaceState; ok: boolean; error?: string }> {
  if (!userId || !friendId || friendId === userId) {
    return {
      state: userId ? await loadPrivateSpace(userId) : emptyState(),
      ok: false,
      error: 'invalid_friend',
    };
  }

  // تفاؤلي محلياً أولاً حتى يظهر الصديق فوراً في الواجهة
  const local = await loadLocal(userId);
  if (!local.friendIds.includes(friendId)) {
    local.friendIds = [friendId, ...local.friendIds];
    if (!local.chats[friendId]) local.chats[friendId] = [];
    await saveLocal(userId, local);
  }

  if (canUseCloud(userId) && isUuid(friendId)) {
    const sb = getSupabase();
    if (sb) {
      const { data: rpcData, error: rpcError } = await sb.rpc(
        'add_private_friend',
        { p_friend_id: friendId }
      );
      const rpc = parsePrivateRpcResult(rpcData);
      if (!rpcError && rpc.ok) {
        return { state: await loadPrivateSpace(userId), ok: true };
      }

      const rpcFailReason =
        rpcError?.message || rpc.error || 'add_friend_failed';
      console.warn('[private-space] add friend rpc', rpcFailReason);

      const { error: ownErr } = await sb.from('private_friends').upsert(
        { owner_id: userId, friend_id: friendId },
        { onConflict: 'owner_id,friend_id' }
      );
      if (!ownErr) {
        await sb.from('private_friends').upsert(
          { owner_id: friendId, friend_id: userId },
          { onConflict: 'owner_id,friend_id' }
        );
        return { state: await loadPrivateSpace(userId), ok: true };
      }

      console.warn('[private-space] add friend', ownErr.message);
      return {
        state: await loadPrivateSpace(userId),
        ok: false,
        error:
          rpcFailReason.includes('friend_not_in_profiles') ||
          ownErr.message.includes('foreign key')
            ? 'friend_not_in_profiles'
            : ownErr.message || rpcFailReason,
      };
    }
  }

  return { state: await loadLocal(userId), ok: true };
}

export async function removePrivateFriend(
  userId: string,
  friendId: string
): Promise<{ state: PrivateSpaceState; ok: boolean; error?: string }> {
  // احذف محلياً أولاً
  const local = await loadLocal(userId);
  local.friendIds = local.friendIds.filter((id) => id !== friendId);
  const { [friendId]: _removed, ...restChats } = local.chats;
  local.chats = restChats;
  await saveLocal(userId, local);

  if (canUseCloud(userId) && isUuid(friendId)) {
    const sb = getSupabase();
    if (sb) {
      const { data: rpcData, error: rpcError } = await sb.rpc(
        'remove_private_friend',
        { p_friend_id: friendId }
      );
      const rpcOk =
        !rpcError &&
        rpcData &&
        typeof rpcData === 'object' &&
        (rpcData as { ok?: boolean }).ok === true;
      if (rpcOk) {
        return { state: await loadPrivateSpace(userId), ok: true };
      }
      if (rpcError) {
        console.warn('[private-space] remove friend rpc', rpcError.message);
      }

      // احتياطي بدون RPC: صداقة + رسائل عندي
      const { error: friendErr } = await sb
        .from('private_friends')
        .delete()
        .eq('owner_id', userId)
        .eq('friend_id', friendId);
      const { error: msgErr } = await sb
        .from('private_messages')
        .delete()
        .eq('owner_id', userId)
        .eq('friend_id', friendId);
      if (friendErr || msgErr) {
        console.warn(
          '[private-space] remove friend',
          friendErr?.message || msgErr?.message
        );
        return {
          state: await loadPrivateSpace(userId),
          ok: false,
          error: friendErr?.message || msgErr?.message || 'cloud_remove_failed',
        };
      }
      return { state: await loadPrivateSpace(userId), ok: true };
    }
  }

  return { state: await loadPrivateSpace(userId), ok: true };
}

export async function clearPrivateChat(
  userId: string,
  friendId: string
): Promise<{ state: PrivateSpaceState; ok: boolean; error?: string }> {
  const local = await loadLocal(userId);
  local.chats = { ...local.chats, [friendId]: [] };
  await saveLocal(userId, local);

  if (canUseCloud(userId) && isUuid(friendId)) {
    const sb = getSupabase();
    if (sb) {
      const { data: rpcData, error: rpcError } = await sb.rpc(
        'clear_private_chat',
        { p_friend_id: friendId }
      );
      const rpcOk =
        !rpcError &&
        rpcData &&
        typeof rpcData === 'object' &&
        (rpcData as { ok?: boolean }).ok === true;
      if (rpcOk) {
        return { state: await loadPrivateSpace(userId), ok: true };
      }
      if (rpcError) {
        console.warn('[private-space] clear chat rpc', rpcError.message);
      }

      const { error } = await sb
        .from('private_messages')
        .delete()
        .eq('owner_id', userId)
        .eq('friend_id', friendId);
      if (error) {
        console.warn('[private-space] clear chat', error.message);
        return {
          state: await loadPrivateSpace(userId),
          ok: false,
          error: error.message,
        };
      }
      return { state: await loadPrivateSpace(userId), ok: true };
    }
  }

  return { state: local, ok: true };
}

export async function sendPrivateChatMessage(
  userId: string,
  friendId: string,
  text: string,
  media?: PrivateChatMediaInput
): Promise<{
  state: PrivateSpaceState;
  ok: boolean;
  error?: string;
  warning?: string;
}> {
  const trimmed = text.trim();
  if (!trimmed && !media?.uri?.trim()) {
    return { state: await loadPrivateSpace(userId), ok: false, error: 'empty' };
  }

  let mediaUrl: string | undefined;
  let mediaKind: PrivateChatMediaKind | undefined;

  if (media?.uri?.trim()) {
    if (canUseCloud(userId)) {
      const resolved = await resolvePublicMediaUrl({
        uri: media.uri.trim(),
        kind: media.kind,
        folder: 'private-dm',
        userId,
        requireCloud: true,
      });
      if (!resolved.url) {
        return {
          state: await loadPrivateSpace(userId),
          ok: false,
          error: resolved.error || 'upload_failed',
        };
      }
      mediaUrl = resolved.url;
      mediaKind = media.kind;
    } else {
      mediaUrl = media.uri.trim();
      mediaKind = media.kind;
    }
  }

  const legacyBody =
    trimmed ||
    (mediaUrl
      ? mediaKind === 'video'
        ? `🎬 ${mediaUrl}`
        : `🖼️ ${mediaUrl}`
      : '');

  const isRpcSuccess = (
    rpcData: unknown,
    rpcError: { message?: string } | null
  ) =>
    !rpcError &&
    rpcData &&
    typeof rpcData === 'object' &&
    (rpcData as { ok?: boolean }).ok === true;

  if (canUseCloud(userId) && isUuid(friendId)) {
    const sb = getSupabase();
    if (sb) {
      const { data: sessionData } = await sb.auth.getSession();
      if (!sessionData.session) {
        return {
          state: await loadPrivateSpace(userId),
          ok: false,
          error: 'no_session',
        };
      }

      await sb.rpc('add_private_friend', { p_friend_id: friendId });

      // 1) RPC وسائط (إن وُجدت الدالة + الأعمدة)
      if (mediaUrl && mediaKind) {
        const { data, error } = await sb.rpc('send_private_message', {
          p_friend_id: friendId,
          p_body: trimmed,
          p_media_url: mediaUrl,
          p_media_kind: mediaKind,
        });
        if (isRpcSuccess(data, error)) {
          return { state: await loadPrivateSpace(userId), ok: true };
        }
        if (error) console.warn('[private-space] send media rpc', error.message);
      }

      // 2) RPC نص فقط (متوافق مع الدالة القديمة والجديدة)
      {
        const { data, error } = await sb.rpc('send_private_message', {
          p_friend_id: friendId,
          p_body: legacyBody,
        });
        if (isRpcSuccess(data, error)) {
          return {
            state: await loadPrivateSpace(userId),
            ok: true,
            warning: mediaUrl ? 'media_schema_missing' : undefined,
          };
        }
        if (error) console.warn('[private-space] send text rpc', error.message);
        else if (data && typeof data === 'object') {
          console.warn(
            '[private-space] send text rpc',
            (data as { error?: string }).error
          );
        }
      }

      // 3) إدراج صفّين — نص فقط (بدون أعمدة وسائط؛ يعمل دائماً على المخطط القديم)
      {
        const { error } = await sb.from('private_messages').insert([
          {
            owner_id: userId,
            friend_id: friendId,
            sender_id: userId,
            body: legacyBody,
          },
          {
            owner_id: friendId,
            friend_id: userId,
            sender_id: userId,
            body: legacyBody,
          },
        ]);
        if (!error) {
          return {
            state: await loadPrivateSpace(userId),
            ok: true,
            warning: mediaUrl ? 'media_schema_missing' : undefined,
          };
        }
        console.warn('[private-space] send text insert', error.message);

        // 4) صف المرسل فقط (نص)
        const { error: ownErr } = await sb.from('private_messages').insert({
          owner_id: userId,
          friend_id: friendId,
          sender_id: userId,
          body: legacyBody,
        });
        if (!ownErr) {
          return {
            state: await loadPrivateSpace(userId),
            ok: false,
            error: 'recipient_inbox_failed',
          };
        }
        console.warn('[private-space] send own text', ownErr.message);
      }

      // 5) محاولة أخيرة مع أعمدة الوسائط إن وُجدت
      if (mediaUrl && mediaKind) {
        const row = {
          sender_id: userId,
          body: trimmed,
          media_url: mediaUrl,
          media_kind: mediaKind,
        };
        const { error } = await sb.from('private_messages').insert([
          { owner_id: userId, friend_id: friendId, ...row },
          { owner_id: friendId, friend_id: userId, ...row },
        ]);
        if (!error) {
          return { state: await loadPrivateSpace(userId), ok: true };
        }
        console.warn('[private-space] send media insert', error.message);
      }

      return {
        state: await loadPrivateSpace(userId),
        ok: false,
        error: 'cloud_send_failed',
      };
    }
  }

  // حساب غير سحابي فقط — محلي
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
    mediaUrl,
    mediaKind,
  });
  state.chats[friendId] = list;
  await saveLocal(userId, state);
  return {
    state,
    ok: false,
    error: isUuid(userId) ? 'cloud_unavailable' : 'local_only',
  };
}

export function subscribePrivateSpace(
  userId: string,
  onChange: () => void
): (() => void) | null {
  if (!canUseCloud(userId)) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const channel = sb
    .channel(`private-space-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'private_messages',
        filter: `owner_id=eq.${userId}`,
      },
      () => onChange()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'private_friends',
        filter: `owner_id=eq.${userId}`,
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
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
  // احذف محلياً أولاً — وإلا loadPrivateSpace يعيد دمج العنصر من AsyncStorage
  const local = await loadLocal(userId);
  const removed = local.items.find((x) => x.id === itemId);
  local.items = local.items.filter((x) => x.id !== itemId);
  await saveLocal(userId, local);

  if (canUseCloud(userId)) {
    const sb = getSupabase();
    if (sb) {
      if (isUuid(itemId)) {
        const { error } = await sb
          .from('private_saved')
          .delete()
          .eq('owner_id', userId)
          .eq('id', itemId);
        if (error) {
          console.warn('[private-space] remove saved by id', error.message);
        }
      }
      if (removed?.sourceId) {
        const { error } = await sb
          .from('private_saved')
          .delete()
          .eq('owner_id', userId)
          .eq('source_id', removed.sourceId);
        if (error) {
          console.warn('[private-space] remove saved by source', error.message);
        }
      }
    }
  }
  return loadPrivateSpace(userId);
}
