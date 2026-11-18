import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import { RouteError } from '@/components/RouteError';

/** Lazy route: the page's code loads when the route is first visited. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

export const routes: RouteObject[] = [
  {
    ErrorBoundary: RouteError,
    children: [
      { path: '/', lazy: page(() => import('./pages/home')) },
      { path: '/r/:code', lazy: page(() => import('./pages/room')) },
      { path: '/q', lazy: page(() => import('./pages/queue')) },
      { path: '*', lazy: page(() => import('./pages/not-found')) },
    ],
  },
];
