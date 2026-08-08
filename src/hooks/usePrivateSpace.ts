import { useCallback, useEffect, useState } from 'react';
import {
  addPrivateContent,
  addPrivateFriend,
  loadPrivateSpace,
  removePrivateContent,
  removePrivateFriend,
  sendPrivateChatMessage,
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

  const addFriend = useCallback(
    async (friendId: string) => {
      if (!userId) return;
      setState(await addPrivateFriend(userId, friendId));
    },
    [userId]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      if (!userId) return;
      setState(await removePrivateFriend(userId, friendId));
    },
    [userId]
  );

  const sendMessage = useCallback(
    async (friendId: string, text: string) => {
      if (!userId) return;
      setState(await sendPrivateChatMessage(userId, friendId, text));
    },
    [userId]
  );

  const saveContent = useCallback(
    async (item: Omit<PrivateContentItem, 'id' | 'savedAt'> & { sourceId: string }) => {
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
    sendMessage,
    saveContent,
    removeContent,
  };
}
