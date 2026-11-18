import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { watchInstallPrompt } from './lib/install';
import { startOfflineCache } from './lib/offlineCache';
import { routes } from './routes';
import { RotateNotice } from './ui/RotateNotice';
import './index.css';

watchInstallPrompt();
startOfflineCache();
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <RotateNotice />
  </StrictMode>,
);
