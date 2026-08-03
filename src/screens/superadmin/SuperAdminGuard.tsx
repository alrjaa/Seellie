import React, { type ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { LoadingState } from '@/components/feedback/LoadingState';

export function SuperAdminGuard({ children }: { children: ReactNode }) {
  const { currentUser, loading, routeForRole } = useTournament();

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/admin" />;
  if (currentUser.role !== 'superadmin') {
    return <Redirect href={routeForRole(currentUser.role) as any} />;
  }

  return <>{children}</>;
}
