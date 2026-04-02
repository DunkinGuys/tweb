const PLATFORM_SESSION_TOKEN_KEY = 'platform_session_token';
const PLATFORM_CURRENT_USER_KEY = 'platform_current_user';

export type PlatformSessionUser = {
  userId: string,
  authProvider: string,
  email: string,
  displayName: string,
  avatarLabel?: string | null
};

export function getPlatformSessionToken() {
  if(typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(PLATFORM_SESSION_TOKEN_KEY)?.trim();
  return value || null;
}

export function setPlatformSessionToken(sessionToken: string) {
  if(typeof window === 'undefined') {
    return;
  }

  const trimmed = sessionToken.trim();
  if(!trimmed) {
    window.localStorage.removeItem(PLATFORM_SESSION_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(PLATFORM_SESSION_TOKEN_KEY, trimmed);
  dispatchPlatformSessionEvent();
}

export function clearPlatformSessionToken() {
  if(typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(PLATFORM_SESSION_TOKEN_KEY);
  window.localStorage.removeItem(PLATFORM_CURRENT_USER_KEY);
  dispatchPlatformSessionEvent();
}

export function isPlatformSessionPresent() {
  return !!getPlatformSessionToken();
}

export function getPlatformCurrentUser() {
  if(typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(PLATFORM_CURRENT_USER_KEY);
  if(!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PlatformSessionUser;
  } catch(err) {
    console.warn('Failed to parse platform current user', err);
    window.localStorage.removeItem(PLATFORM_CURRENT_USER_KEY);
    return null;
  }
}

export function setPlatformCurrentUser(user: PlatformSessionUser | null) {
  if(typeof window === 'undefined') {
    return;
  }

  if(!user) {
    window.localStorage.removeItem(PLATFORM_CURRENT_USER_KEY);
    dispatchPlatformSessionEvent();
    return;
  }

  window.localStorage.setItem(PLATFORM_CURRENT_USER_KEY, JSON.stringify(user));
  dispatchPlatformSessionEvent();
}

function dispatchPlatformSessionEvent() {
  if(typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent('platform-session-updated'));
}
