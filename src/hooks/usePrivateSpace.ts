import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  addPrivateContent,
  addPrivateFriend,
  clearPrivateChat,
  loadPrivateSpace,
  removePrivateContent,
  removePrivateFriend,
  sendPrivateChatMessage,
  subscribePrivateSpace,
  type PrivateChatMediaInput,
  type PrivateContentItem,
  type PrivateSpaceState,
} from '@/services/private-space';
import {
  createInFlightLock,
  startForegroundInterval,
  SYNC_FALLBACK_MS,
} from '@/services/sync-engine';

const empty: PrivateSpaceState = {
  friendIds: [],
  chats: {},
  items: [],
};

export function usePrivateSpace(userId: string | undefined) {
  const [state, setState] = useState<PrivateSpaceState>(empty);
  const [ready, setReady] = useState(false);
  const reloadLock = useRef(createInFlightLock<void>());
  const focusedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setState(empty);
      setReady(true);
      return;
    }
    await reloadLock.current.run(async () => {
      try {
        const next = await loadPrivateSpace(userId);
        setState(next);
      } catch {
        // لا نترك الشاشة عالقة على التحميل عند فشل الجلب — ولا نمسح الحالة
        setState((prev) => prev);
      } finally {
        setReady(true);
      }
    });
  }, [userId]);

  useEffect(() => {
    setReady(false);
    void reload();
  }, [reload]);

  // FIX-02: Realtime primary; no always-on 5s poll
  useEffect(() => {
    if (!userId) return;
    return (
      subscribePrivateSpace(userId, () => {
        void reload();
      }) || undefined
    );
  }, [userId, reload]);

  // Focus reload + slow foreground fallback only while focused
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      focusedRef.current = true;
      void reload();
      const stopPoll = startForegroundInterval(
        SYNC_FALLBACK_MS.privateSpace,
        () => {
          if (focusedRef.current) void reload();
        }
      );
      return () => {
        focusedRef.current = false;
        stopPoll();
      };
    }, [userId, reload])
  );

  const addFriend = useCallback(
    async (friendId: string) => {
      if (!userId) return { ok: false, error: 'no_user' as string };
      // تحديث فوري في الواجهة قبل انتظار السحابة
      setState((prev) => {
        if (prev.friendIds.includes(friendId)) return prev;
        return {
          ...prev,
          friendIds: [friendId, ...prev.friendIds],
          chats: {
            ...prev.chats,
            [friendId]: prev.chats[friendId] || [],
          },
        };
      });
      const result = await addPrivateFriend(userId, friendId);
      setState(result.state);
      return { ok: result.ok, error: result.error };
    },
    [userId]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      if (!userId) return { ok: false, error: 'no_user' as string };
      setState((prev) => {
        const { [friendId]: _c, ...restChats } = prev.chats;
        return {
          ...prev,
          friendIds: prev.friendIds.filter((id) => id !== friendId),
          chats: restChats,
        };
      });
      const result = await removePrivateFriend(userId, friendId);
      setState(result.state);
      return { ok: result.ok, error: result.error };
    },
    [userId]
  );

  const clearChat = useCallback(
    async (friendId: string) => {
      if (!userId) return { ok: false, error: 'no_user' as string };
      setState((prev) => ({
        ...prev,
        chats: { ...prev.chats, [friendId]: [] },
      }));
      const result = await clearPrivateChat(userId, friendId);
      setState(result.state);
      return { ok: result.ok, error: result.error };
    },
    [userId]
  );

  const sendMessage = useCallback(
    async (friendId: string, text: string, media?: PrivateChatMediaInput) => {
      if (!userId) {
        return { ok: false, error: 'no_user' as string };
      }
      const result = await sendPrivateChatMessage(
        userId,
        friendId,
        text,
        media
      );
      setState(result.state);
      return { ok: result.ok, error: result.error, warning: result.warning };
    },
    [userId]
  );

  const saveContent = useCallback(
    async (
      item: Omit<PrivateContentItem, 'id' | 'savedAt'> & { sourceId: string }
    ) => {
      if (!userId) return { added: false };
      const result = await addPrivateContent(userId, item);
      setState(result.state);
      return { added: result.added };
    },
    [userId]
  );

  const removeContent = useCallback(
    async (itemId: string) => {
      if (!userId) return;
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((x) => x.id !== itemId),
      }));
      setState(await removePrivateContent(userId, itemId));
    },
    [userId]
  );

  return {
    ready,
    friendIds: state.friendIds,
    chats: state.chats,
    items: state.items,
    reload,
    addFriend,
    removeFriend,
    clearChat,
    sendMessage,
    saveContent,
    removeContent,
  };
}
