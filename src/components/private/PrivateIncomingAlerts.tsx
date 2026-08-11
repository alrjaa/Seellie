import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import {
  loadPrivateSpace,
  subscribePrivateSpace,
  type PrivateChatMessage,
  type PrivateSpaceState,
} from '@/services/private-space';
import { playPrivateMessageTone } from '@/services/message-tone';

function collectInboundIds(state: PrivateSpaceState): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(state.chats || {})) {
    for (const msg of list || []) {
      if (msg && !msg.fromMe && msg.id) ids.add(msg.id);
    }
  }
  return ids;
}

function newestInbound(
  state: PrivateSpaceState,
  known: Set<string>
): Array<{ friendId: string; message: PrivateChatMessage }> {
  const found: Array<{ friendId: string; message: PrivateChatMessage }> = [];
  for (const [friendId, list] of Object.entries(state.chats || {})) {
    for (const msg of list || []) {
      if (!msg || msg.fromMe || !msg.id || known.has(msg.id)) continue;
      found.push({ friendId, message: msg });
    }
  }
  found.sort(
    (a, b) => Date.parse(b.message.at || '') - Date.parse(a.message.at || '')
  );
  return found;
}

/**
 * مراقبة الرسائل الخاصة الواردة عالمياً:
 * نغمة + إشعار داخل التطبيق + توست.
 */
export function PrivateIncomingAlerts() {
  const { currentUser, users } = useTournament();
  const { addNotification } = useNotifications();
  const { toast } = useToast();
  const { t } = useTranslation();
  const knownIds = useRef<Set<string> | null>(null);
  const usersRef = useRef(users);
  usersRef.current = users;

  useEffect(() => {
    knownIds.current = null;
  }, [currentUser?.id]);

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;

    let cancelled = false;

    const scan = async () => {
      try {
        const state = await loadPrivateSpace(userId);
        if (cancelled) return;
        const inbound = collectInboundIds(state);
        if (!knownIds.current) {
          knownIds.current = inbound;
          return;
        }
        const arrived = newestInbound(state, knownIds.current);
        knownIds.current = inbound;
        if (!arrived.length) return;

        const latest = arrived[0];
        const friend = usersRef.current.find((u) => u.id === latest.friendId);
        const name =
          friend?.handle ||
          friend?.name ||
          t('privateSpace.privateMessageSender');
        const preview =
          latest.message.text?.trim() ||
          (latest.message.mediaKind === 'video'
            ? t('privateSpace.privateMessageVideo')
            : latest.message.mediaUrl
              ? t('privateSpace.privateMessagePhoto')
              : t('privateSpace.privateMessageBody'));

        addNotification({
          id: `pm-${latest.message.id}`,
          kind: 'message',
          recipientId: userId,
          title: t('privateSpace.privateMessageTitle'),
          body: `${name}: ${preview}`,
          href: '/(follower)/private',
        });

        if (AppState.currentState === 'active') {
          void playPrivateMessageTone();
          toast({
            variant: 'success',
            title: t('privateSpace.privateMessageTitle'),
            description: `${name}: ${preview}`,
          });
        }
      } catch {
        // تجاهل أخطاء المراقبة حتى لا تؤثر على بقية التطبيق
      }
    };

    void scan();
    const unsub = subscribePrivateSpace(userId, () => {
      void scan();
    });
    const timer = setInterval(() => {
      void scan();
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      unsub?.();
    };
  }, [currentUser?.id, addNotification, toast, t]);

  return null;
}
