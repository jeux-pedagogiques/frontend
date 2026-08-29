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
      },
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
      }
    ]
  },
  {
    id: 'pedagogical-games',
    title: 'Types d\'Activités & Jeux',
    type: 'group',
    icon: 'icon-group',
    classes: 'nav-group-red',
    children: [
      {
        id: 'recall-memorization',
        title: '1. Recall / Memorization',
        type: 'collapse',
        icon: 'feather icon-layers',
        children: [
          {
            id: 'flashcards',
            title: 'Flashcards',
            type: 'item',
            url: '/flashcards',
            icon: 'feather icon-layers',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'puzzle-problem-solving',
        title: '2. Puzzle / Problem-Solving',
        type: 'collapse',
        icon: 'feather icon-lock',
        children: [
          {
            id: 'escape-room',
            title: 'Escape Room',
            type: 'item',
            url: '/escape-room',
            icon: 'feather icon-lock',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'scenario-simulation',
        title: '3. Scenario-Based Simulation',
        type: 'collapse',
        icon: 'feather icon-briefcase',
        children: [
          {
            id: 'cas-etude',
            title: 'Étude de Cas Gamifiée',
            type: 'item',
            url: '/cas-etude',
            icon: 'feather icon-file-text',
            classes: 'nav-item'
          },
          {
            id: 'negociation',
            title: 'Simulation Négociation',
            type: 'item',
            url: '/negociation',
            icon: 'feather icon-trending-up',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'oral-argumentation',
        title: '4. Oral Argumentation / Persuasion',
        type: 'collapse',
        icon: 'feather icon-mic',
        children: [
          {
            id: 'pitching-challenge',
            title: 'Pitching Challenge',
            type: 'item',
            url: '/pitching-challenge',
            icon: 'feather icon-mic',
            classes: 'nav-item'
          },
          {
            id: 'debat-structure',
            title: 'Débat Structuré',
            type: 'item',
            url: '/debat-structure',
            icon: 'feather icon-users',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'visual-structuring',
        title: '5. Collaborative Visual Structuring',
        type: 'collapse',
        icon: 'feather icon-cpu',
        children: [
          {
            id: 'mindmap',
            title: 'Mind Map Collaboratif',
            type: 'item',
            url: '/mindmap',
            icon: 'feather icon-cpu',
            classes: 'nav-item'
          }
        ]
      },
      {
        id: 'peer-evaluation',
        title: '6. Peer Evaluation',
        type: 'collapse',
        icon: 'feather icon-user-check',
        children: [
          {
            id: 'atelier-feedback',
            title: 'Atelier Feedback Pair',
            type: 'item',
            url: '/atelier-feedback',
            icon: 'feather icon-user-check',
            classes: 'nav-item'
          }
        ]
      }
    ]
  },
  {
    id: 'resources',
    title: 'Ressources & Suivi',
    type: 'group',
    icon: 'icon-group',
    classes: 'nav-group-red',
    children: [
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
