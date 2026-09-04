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
import { getJson, setJson } from '@/services/storage';
import { createId } from '@/utils/id';

const STORAGE_KEY = 'seellie.notifications.v1';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
  kind: 'follow' | 'message' | 'offer' | 'system' | 'media' | 'appreciation';
  /** إن وُجد يُعرض فقط لهذا المستخدم */
  recipientId?: string;
};

type NotificationsApi = {
  addNotification: (
    input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
      read?: boolean;
      /** معرّف ثابت لتجنب التكرار (مثلاً msg-<uuid>) */
      id?: string;
    }
  ) => void;
  markRead: (id: string, userId?: string) => void;
  markAllRead: (userId: string | undefined) => void;
  clearAll: (userId: string | undefined) => void;
};

type NotificationsState = {
  notifications: AppNotification[];
  /** غير المقروء للمستخدم الحالي فقط (أو العامة بلا مستلم) */
  unreadCountFor: (userId: string | undefined) => number;
  forUser: (userId: string | undefined) => AppNotification[];
};

type Ctx = NotificationsApi & NotificationsState;

const NotificationsApiContext = createContext<NotificationsApi | undefined>(
  undefined
);
const NotificationsStateContext = createContext<NotificationsState | undefined>(
  undefined
);

const SEED: AppNotification[] = [
  {
    id: 'n-seed-1',
    title: 'مرحباً بك في Seellie',
    body: 'يمكنك متابعة الحسابات واستكشاف المسابقات من البحث والساحات.',
    createdAt: new Date().toISOString(),
    read: false,
    kind: 'system',
    href: '/search',
  },
];

function visibleToUser(
  n: AppNotification,
  userId: string | undefined
): boolean {
  if (!userId) return !n.recipientId;
  return !n.recipientId || n.recipientId === userId;
}

/**
 * FIX-05 P1 — split API (stable) from list state so TournamentProvider
 * (addNotification/clearAll only) does not re-render on every inbox tick.
 * Behavior / persistence / kinds unchanged.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED);
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = await getJson<AppNotification[]>(STORAGE_KEY);
        if (!active) return;
        if (Array.isArray(stored)) {
          setNotifications(stored.length ? stored : SEED);
        }
      } finally {
        if (active) hydrated.current = true;
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void setJson(STORAGE_KEY, notifications);
  }, [notifications]);

  const addNotification = useCallback(
    (
      input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
        read?: boolean;
        id?: string;
      }
    ) => {
      const id = input.id || createId('notif');
      setNotifications((prev) => {
        if (prev.some((n) => n.id === id)) return prev;
        const next: AppNotification = {
          id,
          title: input.title,
          body: input.body,
          kind: input.kind,
          href: input.href,
          recipientId: input.recipientId,
          createdAt: new Date().toISOString(),
          read: input.read ?? false,
        };
        return [next, ...prev].slice(0, 80);
      });
    },
    []
  );

  const markRead = useCallback((id: string, userId?: string) => {
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        if (userId && n.recipientId && n.recipientId !== userId) return n;
        return { ...n, read: true };
      })
    );
  }, []);

  const markAllRead = useCallback((userId: string | undefined) => {
    setNotifications((prev) =>
      prev.map((n) =>
        visibleToUser(n, userId) ? { ...n, read: true } : n
      )
    );
  }, []);

  const clearAll = useCallback((userId: string | undefined) => {
    setNotifications((prev) => {
      if (!userId) {
        return prev.filter((n) => !!n.recipientId);
      }
      return prev.filter(
        (n) => n.recipientId && n.recipientId !== userId
      );
    });
  }, []);

  const forUser = useCallback(
    (userId: string | undefined) =>
      notifications.filter((n) => visibleToUser(n, userId)),
    [notifications]
  );

  const unreadCountFor = useCallback(
    (userId: string | undefined) =>
      notifications.filter((n) => visibleToUser(n, userId) && !n.read).length,
    [notifications]
  );

  const api = useMemo(
    () => ({
      addNotification,
      markRead,
      markAllRead,
      clearAll,
    }),
    [addNotification, markRead, markAllRead, clearAll]
  );

  const state = useMemo(
    () => ({
      notifications,
      unreadCountFor,
      forUser,
    }),
    [notifications, unreadCountFor, forUser]
  );

  return (
    <NotificationsApiContext.Provider value={api}>
      <NotificationsStateContext.Provider value={state}>
        {children}
      </NotificationsStateContext.Provider>
    </NotificationsApiContext.Provider>
  );
}

/** Stable mutators only — safe for TournamentProvider. */
export function useNotificationsApi() {
  const ctx = useContext(NotificationsApiContext);
  if (!ctx) {
    throw new Error(
      'useNotificationsApi must be used within NotificationsProvider'
    );
  }
  return ctx;
}

export function useNotifications(): Ctx {
  const api = useContext(NotificationsApiContext);
  const state = useContext(NotificationsStateContext);
  if (!api || !state) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return useMemo(() => ({ ...api, ...state }), [api, state]);
}
