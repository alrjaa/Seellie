import { useEffect, useMemo } from 'react';
import { useTournament } from '@/providers/TournamentProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { usePrivateSpaceContext } from '@/providers/PrivateSpaceProvider';
import { setAppIconBadgeCount, rememberAppDocumentTitle } from '@/utils/app-badge';

/** يزامن شارة أيقونة التطبيق مع إجمالي غير المقروء (بدون تغيير عنوان التبويب). */
export function AppBadgeSync() {
  const { currentUser, messages, shareCards } = useTournament();
  const { unreadPrivateCount } = usePrivateSpaceContext();
  const { unreadCountFor } = useNotifications();

  const total = useMemo(() => {
    if (!currentUser?.id) return 0;
    const inbox = messages.filter(
      (m) => m.recipientId === currentUser.id && !m.read
    ).length;
    const shares = shareCards.filter(
      (c) => c.recipientId === currentUser.id && !c.read
    ).length;
    const notifs = unreadCountFor(currentUser.id);
    return inbox + shares + unreadPrivateCount + notifs;
  }, [
    currentUser?.id,
    messages,
    shareCards,
    unreadCountFor,
    unreadPrivateCount,
  ]);

  useEffect(() => {
    rememberAppDocumentTitle('Seellie');
  }, []);

  useEffect(() => {
    setAppIconBadgeCount(total);
  }, [total]);

  return null;
}
