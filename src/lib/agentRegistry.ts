export type AgentRegistryCategory = {
  categoryId: string,
  slug: string,
  name: string,
  description?: string
};

export type AgentRegistryProviderSummary = {
  providerId: string,
  displayName: string,
  verificationStatus?: string
};

export type AgentRegistryAgentSummary = {
  agentId: string,
  providerId: string,
  categoryId: string,
  slug: string,
  name: string,
  headline?: string,
  pricingModel?: string,
  publicationStatus?: string,
  runtimeMode?: string,
  demoTurnLimit?: number,
  priceMinor?: number,
  currency?: string,
  avgRating?: number | null,
  reviewCount?: number,
  category?: AgentRegistryCategory | null,
  provider?: AgentRegistryProviderSummary | null
};

export type AgentRegistryCapability = {
  capabilityKey: string,
  capabilityValue?: Record<string, unknown>
};

export type AgentRegistryAgentDetail = AgentRegistryAgentSummary & {
  description?: string,
  capabilities?: AgentRegistryCapability[]
};

const LOCALHOST_REGISTRY_BASE_URL = 'http://127.0.0.1:8790';
const LOCALHOST_PLATFORM_API_BASE_URL = 'http://127.0.0.1:8799';

export function canUseAgentRegistry() {
  return !!resolveAgentRegistryBaseUrl();
}

export function resolveAgentRegistryBaseUrl() {
  const platformApiOverride = readWindowPlatformApiBaseUrl();
  if(platformApiOverride) {
    return platformApiOverride;
  }

  const windowOverride = readWindowRegistryBaseUrl();
  if(windowOverride) {
    return windowOverride;
  }

  const platformApiUrl = normalizeRegistryBaseUrl(import.meta.env.VITE_PLATFORM_API_URL);
  if(platformApiUrl) {
    return platformApiUrl;
  }

  const configuredUrl = normalizeRegistryBaseUrl(import.meta.env.VITE_AGENT_REGISTRY_URL);
  if(configuredUrl) {
    return configuredUrl;
  }

  if(typeof window === 'undefined') {
    return null;
  }

  return isLocalDevHost(window.location.hostname) ? LOCALHOST_PLATFORM_API_BASE_URL : LOCALHOST_REGISTRY_BASE_URL;
}

export async function fetchAgentRegistryCategories() {
  const payload = await fetchRegistryJson<{ok: boolean, categories?: AgentRegistryCategory[]}>('/categories');
  return Array.isArray(payload.categories) ? payload.categories : [];
}

export async function fetchAgentRegistryAgents(options?: {
  category?: string,
  publicationStatus?: string,
  runtimeMode?: string,
  pricingModel?: string,
  providerId?: string,
  q?: string
}) {
  const searchParams = new URLSearchParams();
  if(options?.category) searchParams.set('category', options.category);
  if(options?.publicationStatus) searchParams.set('publicationStatus', options.publicationStatus);
  if(options?.runtimeMode) searchParams.set('runtimeMode', options.runtimeMode);
  if(options?.pricingModel) searchParams.set('pricingModel', options.pricingModel);
  if(options?.providerId) searchParams.set('providerId', options.providerId);
  if(options?.q) searchParams.set('q', options.q);
  const suffix = searchParams.size ? `?${searchParams.toString()}` : '';
  const payload = await fetchRegistryJson<{ok: boolean, agents?: AgentRegistryAgentSummary[]}>(`/agents${suffix}`);
  return Array.isArray(payload.agents) ? payload.agents : [];
}

export async function fetchAgentRegistryAgentDetail(slug: string) {
  const trimmedSlug = slug.trim();
  if(!trimmedSlug) {
    throw new Error('Agent slug is empty');
  }

  const payload = await fetchRegistryJson<{ok: boolean, agent?: AgentRegistryAgentDetail}>(`/agents/${encodeURIComponent(trimmedSlug)}`);
  if(!payload.agent) {
    throw new Error('Agent detail is missing');
  }

  return payload.agent;
}

function normalizeRegistryBaseUrl(value?: string) {
  if(!value) {
    return null;
  }

  const trimmedValue = value.trim().replace(/\/+$/, '');
  return trimmedValue || null;
}

function readWindowRegistryBaseUrl() {
  if(typeof window === 'undefined') {
    return null;
  }

  return normalizeRegistryBaseUrl((window as typeof window & {
    __agentRegistryBaseUrl?: string
  }).__agentRegistryBaseUrl);
}

function readWindowPlatformApiBaseUrl() {
  if(typeof window === 'undefined') {
    return null;
  }

  return normalizeRegistryBaseUrl((window as typeof window & {
    __platformApiBaseUrl?: string
  }).__platformApiBaseUrl);
}

function isLocalDevHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

async function fetchRegistryJson<T>(pathname: string) {
  const baseUrl = resolveAgentRegistryBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent registry URL is not configured');
  }

  const response = await fetch(`${baseUrl}${pathname}`);
  let payload: T & {ok?: boolean, error?: string, message?: string};
  try {
    payload = await response.json();
  } catch(err) {
    throw new Error(`Agent registry returned invalid JSON: ${String(err)}`);
  }

  if(!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || `Agent registry request failed with status ${response.status}`);
  }

  return payload;
}
