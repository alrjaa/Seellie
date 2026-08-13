/**
 * FIX-02 selective hooks — reduce blast radius without forcing all screens to migrate.
 * `useTournament()` remains the full facade for compatibility.
 */
import { useTournament } from '@/providers/TournamentProvider';

export function useTournamentSession() {
  const {
    currentUser,
    loading,
    login,
    logout,
    signUp,
    changePassword,
    enableSecondaryRole,
    switchActiveRole,
    routeForRole,
    refreshCurrentUserFromCloud,
  } = useTournament();
  return {
    currentUser,
    loading,
    login,
    logout,
    signUp,
    changePassword,
    enableSecondaryRole,
    switchActiveRole,
    routeForRole,
    refreshCurrentUserFromCloud,
  };
}

export function useTournamentMessages() {
  const {
    messages,
    sendMessage,
    markMessageAsRead,
    refreshCloudMessages,
    mergeRemoteMessages,
    currentUser,
  } = useTournament();
  return {
    messages,
    sendMessage,
    markMessageAsRead,
    refreshCloudMessages,
    mergeRemoteMessages,
    currentUser,
  };
}

export function useTournamentShareCards() {
  const {
    shareCards,
    sendShareCard,
    updateShareCardStatus,
    markShareCardRead,
    refreshCloudShareCards,
    currentUser,
  } = useTournament();
  return {
    shareCards,
    sendShareCard,
    updateShareCardStatus,
    markShareCardRead,
    refreshCloudShareCards,
    currentUser,
  };
}
