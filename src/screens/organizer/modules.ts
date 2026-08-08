import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type OrganizerModule = {
  key: string;
  href: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  group: 'core' | 'comms' | 'content' | 'finance' | 'system';
};

export const ORGANIZER_MODULES: OrganizerModule[] = [
  {
    key: 'competitions',
    href: '/(organizer)/competitions',
    icon: 'trophy',
    group: 'core',
  },
  {
    key: 'request-competition',
    href: '/(organizer)/request-competition',
    icon: 'add-circle',
    group: 'core',
  },
  {
    key: 'referees',
    href: '/(organizer)/referees',
    icon: 'flag',
    group: 'core',
  },
  {
    key: 'freelancers',
    href: '/(organizer)/freelancers',
    icon: 'football',
    group: 'core',
  },
  {
    key: 'messages',
    href: '/(organizer)/messages',
    icon: 'chatbubbles',
    group: 'comms',
  },
  {
    key: 'media',
    href: '/(organizer)/media',
    icon: 'images',
    group: 'content',
  },
  {
    key: 'stats',
    href: '/(organizer)/stats',
    icon: 'bar-chart',
    group: 'content',
  },
  {
    key: 'comments',
    href: '/(organizer)/comments',
    icon: 'chatbox-ellipses',
    group: 'content',
  },
  {
    key: 'prizes',
    href: '/(organizer)/prizes',
    icon: 'ribbon',
    group: 'finance',
  },
  {
    key: 'announcements',
    href: '/(organizer)/announcements',
    icon: 'megaphone',
    group: 'comms',
  },
  {
    key: 'financials',
    href: '/(organizer)/financials',
    icon: 'wallet',
    group: 'finance',
  },
  {
    key: 'settings',
    href: '/(organizer)/settings',
    icon: 'settings',
    group: 'system',
  },
];

/** Modules shown on the "more" tab (not primary tabs). */
export const MORE_MODULES = ORGANIZER_MODULES.filter(
  (m) =>
    !['competitions', 'freelancers', 'messages'].includes(m.key)
);
