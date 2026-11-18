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
      { path: '/credits', lazy: page(() => import('./pages/credits')) },
      // A development tool for making the hero portrait images; not shipped as a page of the game.
      ...(import.meta.env.DEV ? [{ path: '/portrait/:heroId', lazy: page(() => import('./pages/portrait')) }] : []),
      { path: '*', lazy: page(() => import('./pages/not-found')) },
    ],
  },
];
