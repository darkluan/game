import { useEffect, useRef } from 'react';

/** The slice of Google Identity Services this app uses. */
interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential?: string }) => void }): void;
      renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
let loading: Promise<void> | null = null;

/** Loads Google's sign-in script once, the first time a button is shown. */
function loadGoogle(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Google's own sign-in button. `onCredential` receives the ID token to send to the server. */
export function GoogleSignIn({
  clientId,
  onCredential,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled || !holder.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) onCredential(response.credential);
          },
        });
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
        });
      })
      .catch(() => {
        // Blocked or offline: the button simply does not appear; guests can still play.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential]);

  return <div ref={holder} />;
}
