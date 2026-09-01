import { useEffect, useMemo } from 'react';
import { useTournament } from '@/providers/TournamentProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { usePrivateSpaceContext } from '@/providers/PrivateSpaceProvider';
import { setAppIconBadgeCount } from '@/utils/app-badge';

/** يزامن شارة أيقونة التطبيق / عنوان التبويب مع إجمالي غير المقروء. */
export function AppBadgeSync() {
  const { currentUser, messages } = useTournament();
  const { unreadPrivateCount } = usePrivateSpaceContext();
  const { unreadCountFor } = useNotifications();

  const total = useMemo(() => {
    if (!currentUser?.id) return 0;
    const inbox = messages.filter(
      (m) => m.recipientId === currentUser.id && !m.read
    ).length;
    const notifs = unreadCountFor(currentUser.id);
    return inbox + unreadPrivateCount + notifs;
  }, [currentUser?.id, messages, unreadCountFor, unreadPrivateCount]);

  useEffect(() => {
    setAppIconBadgeCount(total);
  }, [total]);

  return null;
}
