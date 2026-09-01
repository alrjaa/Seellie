import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useNotificationsApi } from '@/providers/NotificationsProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
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
  type PrivateChatMessage,
  type PrivateContentItem,
  type PrivateSpaceState,
} from '@/services/private-space';
import {
  computePrivateUnreadCount,
  computeThreadUnreadCount,
  loadPrivateReadState,
  readTimestampForThread,
  savePrivateReadState,
  type PrivateReadState,
} from '@/services/private-read-state';
import { isViewingPrivateFriend } from '@/services/private-chat-focus';
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

type IncomingPrivate = { msg: PrivateChatMessage; friendId: string };

function messagePreview(
  msg: PrivateChatMessage,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (msg.mediaKind === 'video') return t('privateSpace.privateMessageVideo');
  if (msg.mediaKind === 'photo') return t('privateSpace.privateMessagePhoto');
  const text = (msg.text || '').trim();
  if (text.startsWith('🎬')) return t('privateSpace.privateMessageVideo');
  if (text.startsWith('🖼️')) return t('privateSpace.privateMessagePhoto');
  if (/^https?:\/\//i.test(text)) {
    return /\.(?:mp4|mov|webm|m4v)/i.test(text)
      ? t('privateSpace.privateMessageVideo')
      : t('privateSpace.privateMessagePhoto');
  }
  return text.slice(0, 120) || t('privateSpace.privateMessageBody');
}

type PrivateSpaceApi = {
  ready: boolean;
  friendIds: string[];
  chats: Record<string, PrivateChatMessage[]>;
  items: PrivateContentItem[];
  unreadPrivateCount: number;
  unreadForFriend: (friendId: string) => number;
  lastReadAtForFriend: (friendId: string) => string | undefined;
  markThreadRead: (friendId: string) => void;
  reload: () => Promise<void>;
  addFriend: (
    friendId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  removeFriend: (
    friendId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  clearChat: (friendId: string) => Promise<{ ok: boolean; error?: string }>;
  sendMessage: (
    friendId: string,
    text: string,
    media?: PrivateChatMediaInput
  ) => Promise<{ ok: boolean; error?: string; warning?: string }>;
  saveContent: (
    item: Omit<PrivateContentItem, 'id' | 'savedAt'> & { sourceId: string }
  ) => Promise<{ added: boolean }>;
  removeContent: (itemId: string) => Promise<void>;
};

const PrivateSpaceContext = createContext<PrivateSpaceApi | undefined>(
  undefined
);

export function PrivateSpaceProvider({ children }: { children: ReactNode }) {
  const { currentUser, users } = useTournament();
  const userId = currentUser?.id;
  const { addNotification, markRead } = useNotificationsApi();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [state, setState] = useState<PrivateSpaceState>(empty);
  const [readState, setReadState] = useState<PrivateReadState>({});
  const [ready, setReady] = useState(false);

  const reloadLock = useRef(createInFlightLock<void>());
  const knownMessageIds = useRef(new Set<string>());
  const initialHydrationDone = useRef(false);
  const readStateRef = useRef<PrivateReadState>({});
  const stateRef = useRef<PrivateSpaceState>(empty);
  const usersRef = useRef(users);
  readStateRef.current = readState;
  stateRef.current = state;
  usersRef.current = users;

  const resolveFriendName = useCallback(
    (friendId: string) => {
      const known = usersRef.current.find((u) => u.id === friendId);
      if (known?.name) return known.name;
      if (known?.handle) return `@${known.handle.replace(/^@/, '')}`;
      const fromSaved = stateRef.current.items.find(
        (i) => i.authorId === friendId
      );
      if (fromSaved?.authorName) return fromSaved.authorName;
      return t('privateSpace.privateMessageSender');
    },
    [t]
  );

  const notifyIncomingPrivate = useCallback(
    (arrived: IncomingPrivate[]) => {
      if (!userId || !arrived.length) return;
      const visible = arrived.filter(
        ({ friendId }) => !isViewingPrivateFriend(friendId)
      );
      if (!visible.length) return;

      for (const { msg, friendId } of visible) {
        const senderName = resolveFriendName(friendId);
        const preview = messagePreview(msg, t);
        addNotification({
          id: `pdm-${msg.id}`,
          kind: 'message',
          recipientId: userId,
          title: t('privateSpace.privateMessageTitle'),
          body: `${senderName}: ${preview}`,
          href: '/(follower)/private',
        });
      }

      if (visible.length === 1) {
        const { friendId, msg } = visible[0];
        toast({
          variant: 'success',
          title: t('privateSpace.privateMessageTitle'),
          description: `${resolveFriendName(friendId)}: ${messagePreview(msg, t)}`,
        });
      } else {
        toast({
          variant: 'success',
          title: t('privateSpace.privateMessageTitle'),
          description: t('privateSpace.privateMessagesBatch', {
            count: visible.length,
          }),
        });
      }
    },
    [addNotification, resolveFriendName, t, toast, userId]
  );

  const notifyIncomingPrivateRef = useRef(notifyIncomingPrivate);
  notifyIncomingPrivateRef.current = notifyIncomingPrivate;

  const collectNewIncoming = useCallback(
    (next: PrivateSpaceState): IncomingPrivate[] => {
      const fresh: IncomingPrivate[] = [];
      for (const [friendId, messages] of Object.entries(next.chats)) {
        for (const msg of messages) {
          if (msg.fromMe || knownMessageIds.current.has(msg.id)) continue;
          fresh.push({ msg, friendId });
        }
      }
      return fresh;
    },
    []
  );

  const indexMessages = useCallback((space: PrivateSpaceState) => {
    for (const messages of Object.values(space.chats)) {
      for (const msg of messages) {
        knownMessageIds.current.add(msg.id);
      }
    }
  }, []);

  const reload = useCallback(async () => {
    if (!userId) {
      setState(empty);
      setReadState({});
      setReady(true);
      return;
    }
    await reloadLock.current.run(async () => {
      try {
        const [next, reads] = await Promise.all([
          loadPrivateSpace(userId),
          loadPrivateReadState(userId),
        ]);
        if (initialHydrationDone.current) {
          const arrived = collectNewIncoming(next);
          if (arrived.length) notifyIncomingPrivateRef.current(arrived);
        } else {
          initialHydrationDone.current = true;
        }
        indexMessages(next);
        setState(next);
        setReadState(reads);
        readStateRef.current = reads;
      } catch {
        setState((prev) => prev);
      } finally {
        setReady(true);
      }
    });
  }, [collectNewIncoming, indexMessages, userId]);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    knownMessageIds.current = new Set();
    initialHydrationDone.current = false;
    setReady(false);
    void reloadRef.current();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    return (
      subscribePrivateSpace(userId, () => {
        void reloadRef.current();
      }) || undefined
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void reloadRef.current();
    });
    const stopPoll = startForegroundInterval(
      SYNC_FALLBACK_MS.privateSpace,
      () => {
        if (AppState.currentState === 'active') void reloadRef.current();
      }
    );
    return () => {
      sub.remove();
      stopPoll();
    };
  }, [userId]);

  const markThreadRead = useCallback(
    (friendId: string) => {
      if (!userId || !friendId) return;
      const messages = stateRef.current.chats[friendId] || [];

      for (const msg of messages) {
        if (!msg.fromMe) {
          markRead(`pdm-${msg.id}`, userId);
        }
      }

      const at = readTimestampForThread(messages);
      const prev = readStateRef.current[friendId];
      if (prev && new Date(prev).getTime() >= new Date(at).getTime()) return;
      const next = { ...readStateRef.current, [friendId]: at };
      readStateRef.current = next;
      setReadState(next);
      void savePrivateReadState(userId, next);
    },
    [markRead, userId]
  );

  const unreadPrivateCount = useMemo(
    () => computePrivateUnreadCount(state, readState),
    [state, readState]
  );

  const unreadForFriend = useCallback(
    (friendId: string) =>
      computeThreadUnreadCount(
        state.chats[friendId] || [],
        readState[friendId]
      ),
    [readState, state.chats]
  );

  const lastReadAtForFriend = useCallback(
    (friendId: string) => readState[friendId],
    [readState]
  );

  const addFriend = useCallback(
    async (friendId: string) => {
      if (!userId) return { ok: false, error: 'no_user' as string };
      setState((prev) => {
        if (prev.friendIds.includes(friendId)) return prev;
        return {
          ...prev,
          friendIds: [friendId, ...prev.friendIds],
          chats: { ...prev.chats, [friendId]: prev.chats[friendId] || [] },
        };
      });
      const result = await addPrivateFriend(userId, friendId);
      setState(result.state);
      indexMessages(result.state);
      return { ok: result.ok, error: result.error };
    },
    [indexMessages, userId]
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
      const nextRead = { ...readStateRef.current };
      delete nextRead[friendId];
      readStateRef.current = nextRead;
      setReadState(nextRead);
      void savePrivateReadState(userId, nextRead);
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
      markThreadRead(friendId);
      return { ok: result.ok, error: result.error };
    },
    [markThreadRead, userId]
  );

  const sendMessage = useCallback(
    async (
      friendId: string,
      text: string,
      media?: PrivateChatMediaInput
    ) => {
      if (!userId) return { ok: false, error: 'no_user' as string };
      const result = await sendPrivateChatMessage(
        userId,
        friendId,
        text,
        media
      );
      setState(result.state);
      indexMessages(result.state);
      return { ok: result.ok, error: result.error, warning: result.warning };
    },
    [indexMessages, userId]
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

  const value = useMemo(
    () => ({
      ready,
      friendIds: state.friendIds,
      chats: state.chats,
      items: state.items,
      unreadPrivateCount,
      unreadForFriend,
      lastReadAtForFriend,
      markThreadRead,
      reload,
      addFriend,
      removeFriend,
      clearChat,
      sendMessage,
      saveContent,
      removeContent,
    }),
    [
      ready,
      state,
      unreadPrivateCount,
      unreadForFriend,
      lastReadAtForFriend,
      markThreadRead,
      reload,
      addFriend,
      removeFriend,
      clearChat,
      sendMessage,
      saveContent,
      removeContent,
    ]
  );

  return (
    <PrivateSpaceContext.Provider value={value}>
      {children}
    </PrivateSpaceContext.Provider>
  );
}

export function usePrivateSpaceContext() {
  const ctx = useContext(PrivateSpaceContext);
  if (!ctx) {
    throw new Error(
      'usePrivateSpaceContext must be used within PrivateSpaceProvider'
    );
  }
  return ctx;
}
