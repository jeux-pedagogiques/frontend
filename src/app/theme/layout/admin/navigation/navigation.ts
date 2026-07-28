export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  badge?: {
    title?: string;
    type?: string;
  };
  children?: NavigationItem[];
}

export const NavigationItems: NavigationItem[] = [
  {
    id: 'main',
    title: 'Principal',
    type: 'group',
    icon: 'icon-group',
    classes: 'nav-group-red',
    children: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        type: 'item',
        url: '/analytics',
        icon: 'feather icon-home'
      }
    ]
  },
  {
    id: 'plateforme',
    title: 'Plateforme',
    type: 'group',
    icon: 'icon-group',
    classes: 'nav-group-red',
    children: [
      {
        id: 'import-module',
        title: 'Import de Fiche',
        type: 'item',
        url: '/import-module',
        icon: 'feather icon-upload-cloud',
        classes: 'nav-item'
      },
      {
        id: 'live-session',
        title: 'Séance en Direct',
        type: 'item',
        url: '/live-session',
        icon: 'feather icon-video',
        classes: 'nav-item'
      },
      {
        id: 'escape-room',
        title: 'Escape Room',
        type: 'item',
        url: '/escape-room',
        icon: 'feather icon-lock',
        classes: 'nav-item'
      },
      {
        id: 'flashcards',
        title: 'Flashcards',
        type: 'item',
        url: '/flashcards',
        icon: 'feather icon-layers',
        classes: 'nav-item'
      },
      {
        id: 'pitching-challenge',
        title: 'Pitching Challenge',
        type: 'item',
        url: '/pitching-challenge',
        icon: 'feather icon-mic',
        classes: 'nav-item'
      },
      {
        id: 'cas-etude',
        title: 'Étude de Cas Gamifiée',
        type: 'item',
        url: '/cas-etude',
        icon: 'feather icon-briefcase',
        classes: 'nav-item'
      },
      {
        id: 'mindmap',
        title: 'Mind Map Collaboratif',
        type: 'item',
        url: '/mindmap',
        icon: 'feather icon-cpu',
        classes: 'nav-item'
      },
      {
        id: 'library',
        title: 'Bibliothèque',
        type: 'item',
        url: '/library',
        icon: 'feather icon-book',
        classes: 'nav-item'
      },
      {
        id: 'prof-dashboard',
        title: 'Tableau de Bord',
        type: 'item',
        url: '/prof-dashboard',
        icon: 'feather icon-bar-chart-2',
        classes: 'nav-item'
      }
    ]
  }
];
