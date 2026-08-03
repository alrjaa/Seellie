import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

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
    href: '/(superadmin)/users',
    icon: 'people',
    group: 'core',
  },
  {
    key: 'referees',
    href: '/(superadmin)/referees',
    icon: 'person',
    group: 'core',
  },
  {
    key: 'competitions',
    href: '/(superadmin)/competitions',
    icon: 'trophy',
    group: 'core',
  },
  {
    key: 'competition-requests',
    href: '/(superadmin)/competition-requests',
    icon: 'checkmark-done',
    group: 'core',
  },
  {
    key: 'analytics',
    href: '/(superadmin)/analytics',
    icon: 'bar-chart',
    group: 'core',
  },
  {
    key: 'messages',
    href: '/(superadmin)/messages',
    icon: 'chatbubbles',
    group: 'comms',
  },
  {
    key: 'emails',
    href: '/(superadmin)/emails',
    icon: 'mail',
    group: 'comms',
  },
  {
    key: 'discussions',
    href: '/(superadmin)/discussions',
    icon: 'chatbox-ellipses',
    group: 'content',
  },
  {
    key: 'analysts',
    href: '/(superadmin)/analysts',
    icon: 'analytics',
    group: 'content',
  },
  {
    key: 'quick-comments',
    href: '/(superadmin)/quick-comments',
    icon: 'archive',
    group: 'content',
  },
  {
    key: 'support',
    href: '/(superadmin)/support',
    icon: 'gift',
    group: 'finance',
  },
  {
    key: 'invoices',
    href: '/(superadmin)/invoices',
    icon: 'document-text',
    group: 'finance',
  },
  {
    key: 'settings',
    href: '/(superadmin)/settings',
    icon: 'settings',
    group: 'system',
  },
  {
    key: 'icons',
    href: '/(superadmin)/icons',
    icon: 'apps',
    group: 'system',
  },
];
