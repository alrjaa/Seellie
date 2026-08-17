import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { adminPath } from '@/utils/admin-portal';

export type AdminModule = {
  key: string;
  href: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  group: 'core' | 'comms' | 'content' | 'finance' | 'system';
};

/** Full control panel modules matching the web superadmin sidebar. */
export const ADMIN_MODULES: AdminModule[] = [
  {
    key: 'users',
    href: adminPath('users'),
    icon: 'people',
    group: 'core',
  },
  {
    key: 'referees',
    href: adminPath('referees'),
    icon: 'person',
    group: 'core',
  },
  {
    key: 'competitions',
    href: adminPath('competitions'),
    icon: 'trophy',
    group: 'core',
  },
  {
    key: 'competition-requests',
    href: adminPath('competition-requests'),
    icon: 'checkmark-done',
    group: 'core',
  },
  {
    key: 'analytics',
    href: adminPath('analytics'),
    icon: 'bar-chart',
    group: 'core',
  },
  {
    key: 'messages',
    href: adminPath('messages'),
    icon: 'chatbubbles',
    group: 'comms',
  },
  {
    key: 'emails',
    href: adminPath('emails'),
    icon: 'mail',
    group: 'comms',
  },
  {
    key: 'discussions',
    href: adminPath('discussions'),
    icon: 'chatbox-ellipses',
    group: 'content',
  },
  {
    key: 'analysts',
    href: adminPath('analysts'),
    icon: 'analytics',
    group: 'content',
  },
  {
    key: 'quick-comments',
    href: adminPath('quick-comments'),
    icon: 'archive',
    group: 'content',
  },
  {
    key: 'ads',
    href: adminPath('ads'),
    icon: 'film',
    group: 'content',
  },
  {
    key: 'support',
    href: adminPath('support'),
    icon: 'gift',
    group: 'finance',
  },
  {
    key: 'invoices',
    href: adminPath('invoices'),
    icon: 'document-text',
    group: 'finance',
  },
  {
    key: 'settings',
    href: adminPath('settings'),
    icon: 'settings',
    group: 'system',
  },
  {
    key: 'icons',
    href: adminPath('icons'),
    icon: 'apps',
    group: 'system',
  },
];
