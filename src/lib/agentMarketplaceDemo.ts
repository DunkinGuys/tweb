import {pushAgentCardPreviewToCurrentChatAsync, type AgentCardPreviewPayload} from '@lib/agentCardPreviewBridge';
import {
  getAgentCardPreviewRuntimeContext,
  getCurrentAgentCardPreviewChatContextAsync,
  hydrateCurrentAgentCardPreviewComposer,
  type AgentCardPreviewReplyDraft
} from '@lib/agentCardPreviewGateway';
import type {AgentRegistryAgentDetail} from '@lib/agentRegistry';

export type AgentMarketplaceDemoResponse = {
  ok: boolean,
  engagementId?: string,
  conversationId?: string,
  mode?: 'demo',
  demoTurnLimit?: number | null,
  agent?: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug' | 'name' | 'headline' | 'pricingModel' | 'demoTurnLimit'>,
  introCard?: AgentCardPreviewPayload,
  introReplyDraft?: AgentCardPreviewReplyDraft | null,
  engagement?: AgentMarketplaceDemoEngagement | null,
  error?: string,
  message?: string
};

export type AgentMarketplaceDemoTurnResponse = {
  ok: boolean,
  engagement?: AgentMarketplaceDemoEngagement | null,
  previewCard?: AgentCardPreviewPayload | null,
  replyDraft?: AgentCardPreviewReplyDraft | null,
  error?: string,
  message?: string
};

export type AgentMarketplaceDemoUpgradeIntentResponse = {
  ok: boolean,
  checkoutIntentId?: string,
  engagement?: AgentMarketplaceDemoEngagement | null,
  agent?: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug' | 'name' | 'headline' | 'pricingModel' | 'demoTurnLimit'> | null,
  priceMinor?: number | null,
  currency?: string | null,
  pricingModel?: string | null,
  headline?: string | null,
  ctaCard?: AgentCardPreviewPayload | null,
  checkoutDraft?: AgentCardPreviewReplyDraft | null,
  error?: string,
  message?: string
};

export type AgentMarketplaceCheckoutIntent = {
  checkoutIntentId: string,
  createdAt?: string,
  engagementId: string,
  state?: string,
  priceMinor?: number | null,
  currency?: string | null,
  pricingModel?: string | null,
  headline?: string | null,
  agent?: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug' | 'name' | 'headline' | 'pricingModel' | 'demoTurnLimit'> | null
};

export type AgentMarketplaceCheckoutSession = {
  checkoutSessionId: string,
  createdAt?: string,
  checkoutIntentId: string,
  engagementId: string,
  state?: string,
  paymentMethod?: string | null,
  providerName?: string | null,
  priceMinor?: number | null,
  currency?: string | null,
  pricingModel?: string | null,
  agent?: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug' | 'name' | 'headline' | 'pricingModel' | 'demoTurnLimit'> | null
};

export type AgentMarketplaceCheckoutSessionResponse = {
  ok: boolean,
  checkoutSessionId?: string,
  checkoutIntent?: AgentMarketplaceCheckoutIntent | null,
  checkoutSession?: AgentMarketplaceCheckoutSession | null,
  checkoutCard?: AgentCardPreviewPayload | null,
  checkoutDraft?: AgentCardPreviewReplyDraft | null,
  error?: string,
  message?: string
};

export type AgentMarketplaceCheckoutConfirmResponse = {
  ok: boolean,
  checkoutSession?: AgentMarketplaceCheckoutSession | null,
  engagement?: AgentMarketplaceDemoEngagement | null,
  previewCard?: AgentCardPreviewPayload | null,
  replyDraft?: AgentCardPreviewReplyDraft | null,
  error?: string,
  message?: string
};

export type AgentMarketplacePaidStartResponse = {
  ok: boolean,
  engagement?: AgentMarketplaceDemoEngagement | null,
  previewCard?: AgentCardPreviewPayload | null,
  replyDraft?: AgentCardPreviewReplyDraft | null,
  error?: string,
  message?: string
};

export type AgentMarketplacePaidContinueResponse = AgentMarketplacePaidStartResponse;

export type AgentMarketplaceDemoEngagement = {
  engagementId: string,
  conversationId?: string,
  mode: 'demo',
  createdAt?: string,
  state?: string,
  turnUsage?: number,
  paidTurnCount?: number,
  remainingTurns?: number,
  agent?: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug' | 'name' | 'headline' | 'pricingModel' | 'demoTurnLimit'> | null,
  peerId?: number,
  threadId?: number | null,
  monoforumThreadId?: number | null
};

const LOCALHOST_DEMO_BASE_URL = 'http://127.0.0.1:8791';
const LOCALHOST_PLATFORM_API_BASE_URL = 'http://127.0.0.1:8799';

export function canUseAgentMarketplaceDemo() {
  return !!resolveAgentMarketplaceDemoBaseUrl();
}

export function resolveAgentMarketplaceDemoBaseUrl() {
  const platformApiOverride = readWindowPlatformApiBaseUrl();
  if(platformApiOverride) {
    return platformApiOverride;
  }

  const windowOverride = readWindowDemoBaseUrl();
  if(windowOverride) {
    return windowOverride;
  }

  const platformApiUrl = normalizeDemoBaseUrl(import.meta.env.VITE_PLATFORM_API_URL);
  if(platformApiUrl) {
    return platformApiUrl;
  }

  const configuredUrl = normalizeDemoBaseUrl(import.meta.env.VITE_AGENT_MARKETPLACE_DEMO_URL);
  if(configuredUrl) {
    return configuredUrl;
  }

  if(typeof window === 'undefined') {
    return null;
  }

  return isLocalDevHost(window.location.hostname) ? LOCALHOST_PLATFORM_API_BASE_URL : LOCALHOST_DEMO_BASE_URL;
}

export async function requestAgentMarketplaceDemoStart(
  agent: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug'>,
  runtimeContext = getAgentCardPreviewRuntimeContext()
) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const chatContext = await getCurrentAgentCardPreviewChatContextAsync();
  if(!chatContext) {
    throw new Error('현재 채팅을 찾을 수 없어');
  }

  const response = await fetch(`${baseUrl}/engagements/demo/start`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      agentId: agent.agentId,
      agentSlug: agent.slug,
      ...(runtimeContext ? {runtimeContext} : {}),
      ...chatContext
    })
  });

  const payload = await parseJsonResponse<AgentMarketplaceDemoResponse>(response);
  if(!response.ok || !payload.ok || !payload.introCard) {
    throw new Error(payload.message || payload.error || `Agent demo request failed with status ${response.status}`);
  }

  return payload;
}

export async function fetchCurrentAgentMarketplaceDemo(
  agent: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug'>
) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const chatContext = await getCurrentAgentCardPreviewChatContextAsync();
  if(!chatContext) {
    throw new Error('현재 채팅을 찾을 수 없어');
  }

  const searchParams = new URLSearchParams({
    peerId: String(chatContext.peerId),
    agentId: agent.agentId,
    agentSlug: agent.slug
  });
  if(chatContext.threadId !== null) {
    searchParams.set('threadId', String(chatContext.threadId));
  }
  if(chatContext.monoforumThreadId !== null) {
    searchParams.set('monoforumThreadId', String(chatContext.monoforumThreadId));
  }

  const response = await fetch(`${baseUrl}/engagements/current?${searchParams.toString()}`);
  const payload = await parseJsonResponse<{ok: boolean, engagement?: AgentMarketplaceDemoEngagement | null, error?: string, message?: string}>(response);
  if(!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || `Agent demo current request failed with status ${response.status}`);
  }

  return payload.engagement || null;
}

export async function fetchCurrentAgentMarketplaceUpgradeIntent(
  agent: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug'>
) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const chatContext = await getCurrentAgentCardPreviewChatContextAsync();
  if(!chatContext) {
    throw new Error('현재 채팅을 찾을 수 없어');
  }

  const searchParams = new URLSearchParams({
    peerId: String(chatContext.peerId),
    agentId: agent.agentId,
    agentSlug: agent.slug
  });
  if(chatContext.threadId !== null) {
    searchParams.set('threadId', String(chatContext.threadId));
  }
  if(chatContext.monoforumThreadId !== null) {
    searchParams.set('monoforumThreadId', String(chatContext.monoforumThreadId));
  }

  const response = await fetch(`${baseUrl}/checkout/intents/current?${searchParams.toString()}`);
  const payload = await parseJsonResponse<{ok: boolean, checkoutIntent?: AgentMarketplaceCheckoutIntent | null, error?: string, message?: string}>(response);
  if(!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || `Agent demo checkout current request failed with status ${response.status}`);
  }

  return payload.checkoutIntent || null;
}

export async function fetchCurrentAgentMarketplaceCheckoutSession(
  agent: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug'>
) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const chatContext = await getCurrentAgentCardPreviewChatContextAsync();
  if(!chatContext) {
    throw new Error('현재 채팅을 찾을 수 없어');
  }

  const searchParams = new URLSearchParams({
    peerId: String(chatContext.peerId),
    agentId: agent.agentId,
    agentSlug: agent.slug
  });
  if(chatContext.threadId !== null) {
    searchParams.set('threadId', String(chatContext.threadId));
  }
  if(chatContext.monoforumThreadId !== null) {
    searchParams.set('monoforumThreadId', String(chatContext.monoforumThreadId));
  }

  const response = await fetch(`${baseUrl}/checkout/sessions/current?${searchParams.toString()}`);
  const payload = await parseJsonResponse<{ok: boolean, checkoutSession?: AgentMarketplaceCheckoutSession | null, error?: string, message?: string}>(response);
  if(!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || `Agent demo checkout session request failed with status ${response.status}`);
  }

  return payload.checkoutSession || null;
}

export async function startAgentMarketplaceDemoForCurrentChat(
  agent: Pick<AgentRegistryAgentDetail, 'agentId' | 'slug'>,
  runtimeContext = getAgentCardPreviewRuntimeContext()
) {
  const response = await requestAgentMarketplaceDemoStart(agent, runtimeContext);
  const previewPayload: AgentCardPreviewPayload = {
    ...response.introCard,
    sourceAgentId: response.agent?.agentId || agent.agentId,
    sourceAgentSlug: response.agent?.slug || agent.slug,
    sourceEngagementId: response.engagementId,
    sourceTurnUsage: response.engagement?.turnUsage,
    sourceRemainingTurns: response.engagement?.remainingTurns
  };

  const ok = await pushAgentCardPreviewToCurrentChatAsync(previewPayload, 'agent-marketplace-demo');
  if(!ok) {
    throw new Error('Unable to mount marketplace demo into the current chat');
  }

  if(response.introReplyDraft?.text) {
    hydrateCurrentAgentCardPreviewComposer(response.introReplyDraft.text);
  }

  return {
    ...response,
    introCard: previewPayload
  };
}

export async function consumeAgentMarketplaceDemoTurnForCurrentChat(engagementId: string) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const trimmedEngagementId = engagementId.trim();
  if(!trimmedEngagementId) {
    throw new Error('engagementId is required');
  }

  const response = await fetch(`${baseUrl}/engagements/demo/consume-turn`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      engagementId: trimmedEngagementId
    })
  });

  const payload = await parseJsonResponse<AgentMarketplaceDemoTurnResponse>(response);
  if(!response.ok || payload.ok === false || !payload.engagement) {
    throw new Error(payload.message || payload.error || `Agent demo consume-turn request failed with status ${response.status}`);
  }

  if(payload.previewCard) {
    const previewPayload: AgentCardPreviewPayload = {
      ...payload.previewCard,
      sourceAgentId: payload.engagement.agent?.agentId,
      sourceAgentSlug: payload.engagement.agent?.slug,
      sourceEngagementId: payload.engagement.engagementId,
      sourceTurnUsage: payload.engagement.turnUsage,
      sourceRemainingTurns: payload.engagement.remainingTurns
    };
    await pushAgentCardPreviewToCurrentChatAsync(previewPayload, 'agent-marketplace-demo');
  }

  if(payload.replyDraft?.text) {
    hydrateCurrentAgentCardPreviewComposer(payload.replyDraft.text);
  }

  return payload;
}

export async function createAgentMarketplaceDemoUpgradeIntentForCurrentChat(engagementId: string) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const trimmedEngagementId = engagementId.trim();
  if(!trimmedEngagementId) {
    throw new Error('engagementId is required');
  }

  const response = await fetch(`${baseUrl}/checkout/intents`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      engagementId: trimmedEngagementId
    })
  });

  const payload = await parseJsonResponse<AgentMarketplaceDemoUpgradeIntentResponse>(response);
  if(!response.ok || payload.ok === false || !payload.engagement) {
    throw new Error(payload.message || payload.error || `Agent demo checkout request failed with status ${response.status}`);
  }

  if(payload.ctaCard) {
    const previewPayload: AgentCardPreviewPayload = {
      ...payload.ctaCard,
      sourceAgentId: payload.engagement.agent?.agentId,
      sourceAgentSlug: payload.engagement.agent?.slug,
      sourceEngagementId: payload.engagement.engagementId,
      sourceTurnUsage: payload.engagement.turnUsage,
      sourceRemainingTurns: payload.engagement.remainingTurns
    };
    await pushAgentCardPreviewToCurrentChatAsync(previewPayload, 'agent-marketplace-demo');
  }

  if(payload.checkoutDraft?.text) {
    hydrateCurrentAgentCardPreviewComposer(payload.checkoutDraft.text);
  }

  return payload;
}

export async function createAgentMarketplaceCheckoutSessionForCurrentChat(checkoutIntentId: string) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const trimmedCheckoutIntentId = checkoutIntentId.trim();
  if(!trimmedCheckoutIntentId) {
    throw new Error('checkoutIntentId is required');
  }

  const response = await fetch(`${baseUrl}/checkout/sessions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      checkoutIntentId: trimmedCheckoutIntentId
    })
  });

  const payload = await parseJsonResponse<AgentMarketplaceCheckoutSessionResponse>(response);
  if(!response.ok || payload.ok === false || !payload.checkoutSession) {
    throw new Error(payload.message || payload.error || `Agent demo checkout session creation failed with status ${response.status}`);
  }

  if(payload.checkoutCard) {
    const previewPayload: AgentCardPreviewPayload = {
      ...payload.checkoutCard,
      sourceAgentId: payload.checkoutSession.agent?.agentId,
      sourceAgentSlug: payload.checkoutSession.agent?.slug,
      sourceEngagementId: payload.checkoutSession.engagementId
    };
    await pushAgentCardPreviewToCurrentChatAsync(previewPayload, 'agent-marketplace-demo');
  }

  if(payload.checkoutDraft?.text) {
    hydrateCurrentAgentCardPreviewComposer(payload.checkoutDraft.text);
  }

  return payload;
}

export async function confirmAgentMarketplaceCheckoutSessionForCurrentChat(checkoutSessionId: string) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const trimmedCheckoutSessionId = checkoutSessionId.trim();
  if(!trimmedCheckoutSessionId) {
    throw new Error('checkoutSessionId is required');
  }

  const response = await fetch(`${baseUrl}/checkout/sessions/confirm`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      checkoutSessionId: trimmedCheckoutSessionId
    })
  });

  const payload = await parseJsonResponse<AgentMarketplaceCheckoutConfirmResponse>(response);
  if(!response.ok || payload.ok === false || !payload.checkoutSession) {
    throw new Error(payload.message || payload.error || `Agent demo checkout confirm failed with status ${response.status}`);
  }

  if(payload.previewCard) {
    const previewPayload: AgentCardPreviewPayload = {
      ...payload.previewCard,
      sourceAgentId: payload.engagement?.agent?.agentId || payload.checkoutSession.agent?.agentId,
      sourceAgentSlug: payload.engagement?.agent?.slug || payload.checkoutSession.agent?.slug,
      sourceEngagementId: payload.engagement?.engagementId || payload.checkoutSession.engagementId,
      sourceTurnUsage: payload.engagement?.turnUsage,
      sourceRemainingTurns: payload.engagement?.remainingTurns
    };
    await pushAgentCardPreviewToCurrentChatAsync(previewPayload, 'agent-marketplace-demo');
  }

  if(payload.replyDraft?.text) {
    hydrateCurrentAgentCardPreviewComposer(payload.replyDraft.text);
  }

  return payload;
}

export async function startAgentMarketplacePaidFlowForCurrentChat(engagementId: string) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const trimmedEngagementId = engagementId.trim();
  if(!trimmedEngagementId) {
    throw new Error('engagementId is required');
  }

  const response = await fetch(`${baseUrl}/engagements/paid/start`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      engagementId: trimmedEngagementId
    })
  });

  const payload = await parseJsonResponse<AgentMarketplacePaidStartResponse>(response);
  if(!response.ok || payload.ok === false || !payload.engagement) {
    throw new Error(payload.message || payload.error || `Agent paid-flow start failed with status ${response.status}`);
  }

  if(payload.previewCard) {
    const previewPayload: AgentCardPreviewPayload = {
      ...payload.previewCard,
      sourceAgentId: payload.engagement.agent?.agentId,
      sourceAgentSlug: payload.engagement.agent?.slug,
      sourceEngagementId: payload.engagement.engagementId,
      sourceTurnUsage: payload.engagement.turnUsage,
      sourceRemainingTurns: payload.engagement.remainingTurns
    };
    await pushAgentCardPreviewToCurrentChatAsync(previewPayload, 'agent-marketplace-demo');
  }

  if(payload.replyDraft?.text) {
    hydrateCurrentAgentCardPreviewComposer(payload.replyDraft.text);
  }

  return payload;
}

export async function continueAgentMarketplacePaidFlowForCurrentChat(engagementId: string) {
  const baseUrl = resolveAgentMarketplaceDemoBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent demo URL is not configured');
  }

  const trimmedEngagementId = engagementId.trim();
  if(!trimmedEngagementId) {
    throw new Error('engagementId is required');
  }

  const response = await fetch(`${baseUrl}/engagements/paid/continue`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      engagementId: trimmedEngagementId
    })
  });

  const payload = await parseJsonResponse<AgentMarketplacePaidContinueResponse>(response);
  if(!response.ok || payload.ok === false || !payload.engagement) {
    throw new Error(payload.message || payload.error || `Agent paid-flow continue failed with status ${response.status}`);
  }

  if(payload.previewCard) {
    const previewPayload: AgentCardPreviewPayload = {
      ...payload.previewCard,
      sourceAgentId: payload.engagement.agent?.agentId,
      sourceAgentSlug: payload.engagement.agent?.slug,
      sourceEngagementId: payload.engagement.engagementId,
      sourceTurnUsage: payload.engagement.turnUsage,
      sourceRemainingTurns: payload.engagement.remainingTurns
    };
    await pushAgentCardPreviewToCurrentChatAsync(previewPayload, 'agent-marketplace-demo');
  }

  if(payload.replyDraft?.text) {
    hydrateCurrentAgentCardPreviewComposer(payload.replyDraft.text);
  }

  return payload;
}

function normalizeDemoBaseUrl(value?: string) {
  if(!value) {
    return null;
  }

  const trimmedValue = value.trim().replace(/\/+$/, '');
  return trimmedValue || null;
}

function readWindowDemoBaseUrl() {
  if(typeof window === 'undefined') {
    return null;
  }

  return normalizeDemoBaseUrl((window as typeof window & {
    __agentMarketplaceDemoBaseUrl?: string
  }).__agentMarketplaceDemoBaseUrl);
}

function readWindowPlatformApiBaseUrl() {
  if(typeof window === 'undefined') {
    return null;
  }

  return normalizeDemoBaseUrl((window as typeof window & {
    __platformApiBaseUrl?: string
  }).__platformApiBaseUrl);
}

function isLocalDevHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

async function parseJsonResponse<T>(response: Response) {
  const rawText = await response.text();
  if(!rawText) {
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch(err) {
    throw new Error(`Agent demo returned invalid JSON: ${String(err)}`);
  }
}
