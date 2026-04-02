import {fetchPlatformJson, resolvePlatformApiBaseUrl} from '@lib/platformApi';

type GoogleIdentityCredentialResponse = {
  credential: string
};

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string,
        callback: (response: GoogleIdentityCredentialResponse) => void,
        auto_select?: boolean,
        use_fedcm_for_prompt?: boolean
      }) => void,
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void,
      cancel: () => void
    }
  }
};

export type PlatformUser = {
  userId: string,
  authProvider: string,
  email: string,
  displayName: string,
  avatarLabel?: string | null
};

export type PlatformSession = {
  sessionToken: string,
  userId: string,
  createdAt: string,
  expiresAt?: string | null,
  authProvider?: string
};

type PlatformSessionPayload = {
  ok?: boolean,
  user?: PlatformUser,
  session?: PlatformSession
};

export async function createGoogleSession(payload: {
  credential?: string,
  email?: string,
  displayName?: string,
  avatarLabel?: string
}) {
  const baseUrl = resolvePlatformApiBaseUrl();
  if(!baseUrl) {
    throw new Error('Platform API URL is not configured');
  }

  const result = await fetchPlatformJson<PlatformSessionPayload>('/auth/google/session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if(!result.user || !result.session) {
    throw new Error('Platform session response is missing');
  }
  return result;
}

export async function fetchMe(sessionToken: string) {
  const trimmedToken = sessionToken.trim();
  if(!trimmedToken) {
    throw new Error('Session token is empty');
  }

  const baseUrl = resolvePlatformApiBaseUrl();
  if(!baseUrl) {
    throw new Error('Platform API URL is not configured');
  }

  const result = await fetchPlatformJson<PlatformSessionPayload>('/me', {
    headers: {
      authorization: `Bearer ${trimmedToken}`
    }
  });
  if(!result.user || !result.session) {
    throw new Error('Current user payload is missing');
  }
  return result;
}

export function getGoogleAuthStartUrl(returnTo?: string) {
  const baseUrl = resolvePlatformApiBaseUrl();
  if(!baseUrl) {
    throw new Error('Platform API URL is not configured');
  }

  const targetReturnUrl = returnTo || `${window.location.origin}/?platform=1`;
  const authUrl = new URL('/auth/google/start', baseUrl);
  authUrl.searchParams.set('returnTo', targetReturnUrl);
  return authUrl.toString();
}

export function getGoogleClientId() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  return clientId || null;
}

export function isGoogleIdentityEnabled() {
  return !!getGoogleClientId();
}

export function isGoogleRedirectEnabled() {
  const envValue = import.meta.env.VITE_PLATFORM_GOOGLE_AUTH_ENABLED?.trim().toLowerCase();
  return envValue === '1' || envValue === 'true';
}

export async function renderGoogleIdentityButton(
  element: HTMLElement,
  onCredential: (credential: string) => void
) {
  const clientId = getGoogleClientId();
  if(!clientId) {
    throw new Error('Google client id is not configured');
  }

  const googleIdentity = await loadGoogleIdentity();
  googleIdentity.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      if(response?.credential) {
        onCredential(response.credential);
      }
    },
    auto_select: false,
    use_fedcm_for_prompt: true
  });
  element.replaceChildren();
  googleIdentity.accounts.id.renderButton(element, {
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    width: Math.max(240, Math.min(360, element.clientWidth || 280))
  });
}

let googleIdentityPromise: Promise<GoogleIdentity> | undefined;

async function loadGoogleIdentity() {
  if(typeof window === 'undefined') {
    throw new Error('Google Identity is only available in the browser');
  }

  if((window as typeof window & {google?: GoogleIdentity}).google?.accounts?.id) {
    return (window as typeof window & {google: GoogleIdentity}).google;
  }

  if(!googleIdentityPromise) {
    googleIdentityPromise = new Promise<GoogleIdentity>((resolve, reject) => {
      const existingScript = document.querySelector('script[data-google-identity="1"]') as HTMLScriptElement | null;
      const handleReady = () => {
        const googleIdentity = (window as typeof window & {google?: GoogleIdentity}).google;
        if(googleIdentity?.accounts?.id) {
          resolve(googleIdentity);
          return;
        }

        reject(new Error('Google Identity client did not initialize'));
      };

      if(existingScript) {
        existingScript.addEventListener('load', handleReady, {once: true});
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity client')), {once: true});
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = '1';
      script.addEventListener('load', handleReady, {once: true});
      script.addEventListener('error', () => reject(new Error('Failed to load Google Identity client')), {once: true});
      document.head.append(script);
    });
  }

  return googleIdentityPromise;
}
