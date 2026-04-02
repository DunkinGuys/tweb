import {getPlatformSessionToken} from '@lib/platformSession';

const LOCALHOST_PLATFORM_API_BASE_URL = 'http://127.0.0.1:8799';

export function resolvePlatformApiBaseUrl() {
  const windowOverride = typeof window !== 'undefined' ? normalizeBaseUrl((window as typeof window & {__platformApiBaseUrl?: string}).__platformApiBaseUrl) : null;
  if(windowOverride) {
    return windowOverride;
  }

  const envValue = normalizeBaseUrl(import.meta.env.VITE_PLATFORM_API_URL);
  if(envValue) {
    return envValue;
  }

  if(typeof window === 'undefined') {
    return null;
  }

  return isLocalDevHost(window.location.hostname) ? LOCALHOST_PLATFORM_API_BASE_URL : null;
}

export function createPlatformApiHeaders(extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    ...extraHeaders
  };

  const sessionToken = getPlatformSessionToken();
  if(sessionToken) {
    headers.authorization = `Bearer ${sessionToken}`;
  }

  return headers;
}

export async function fetchPlatformJson<T>(pathname: string, init?: RequestInit) {
  const baseUrl = resolvePlatformApiBaseUrl();
  if(!baseUrl) {
    throw new Error('Platform API URL is not configured');
  }

  const mergedHeaders = createPlatformApiHeaders({
    ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {})
  });
  const hasHeaders = Object.keys(mergedHeaders).length > 0;

  const url = `${baseUrl}${pathname}`;
  const hasInit = !!init && Object.keys(init).length > 0;

  const response = !hasInit && !hasHeaders ?
    await fetch(url) :
    await fetch(url, {
      ...init,
      ...(hasHeaders ? {headers: mergedHeaders} : {})
    });

  const payload = await response.json().catch((err) => {
    throw new Error(`Platform API returned invalid JSON: ${String(err)}`);
  }) as T & {ok?: boolean, error?: string, message?: string};

  if(!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || `Platform API request failed with status ${response.status}`);
  }

  return payload;
}

function normalizeBaseUrl(value?: string) {
  if(!value) {
    return null;
  }

  const trimmedValue = value.trim().replace(/\/+$/, '');
  return trimmedValue || null;
}

function isLocalDevHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
