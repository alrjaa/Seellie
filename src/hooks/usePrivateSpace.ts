import { useCallback, useEffect, useState } from 'react';
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

const empty: PrivateSpaceState = {
  friendIds: [],
  chats: {},
  items: [],
};

export function usePrivateSpace(userId: string | undefined) {
  const [state, setState] = useState<PrivateSpaceState>(empty);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setState(empty);
      setReady(true);
      return;
    }
    const next = await loadPrivateSpace(userId);
    setState(next);
    setReady(true);
  }, [userId]);

  useEffect(() => {
    setReady(false);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => {
      void reload();
    }, 5000);
    return () => clearInterval(timer);
  }, [userId, reload]);

  useEffect(() => {
    if (!userId) return;
    return (
      subscribePrivateSpace(userId, () => {
        void reload();
      }) || undefined
    );
  }, [userId, reload]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void reload();
    }, [userId, reload])
  );

  const addFriend = useCallback(
    async (friendId: string) => {
      if (!userId) return;
      setState(await addPrivateFriend(userId, friendId));
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
