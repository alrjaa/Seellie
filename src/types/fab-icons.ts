export type FabIconConfig = {
  id: string;
  label: string;
  /** Ionicons glyph name, e.g. diamond-outline */
  icon: string;
  href: string;
};

export const DEFAULT_FAB_ICONS: FabIconConfig[] = [
  {
    id: 'fab-1',
    label: 'Unique',
    icon: 'diamond-outline',
    href: '/unique',
  },
  {
    id: 'fab-2',
    label: 'Forums',
    icon: 'chatbox-ellipses-outline',
    href: '/forums',
  },
  {
    id: 'fab-3',
    label: 'Shares',
    icon: 'share-social-outline',
    href: '/shares',
  },
  {
    id: 'fab-4',
    label: 'Search',
    icon: 'search-outline',
    href: '/search',
  },
];

export const FAB_ICONS_STORAGE_KEY = 'seellie.fabIcons.v1';
