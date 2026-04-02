import {fetchPlatformJson, resolvePlatformApiBaseUrl} from '@lib/platformApi';

export type ConversationParticipant = {
  participantId: string,
  participantType: 'user' | 'agent',
  displayName: string,
  avatarLabel?: string | null
};

export type ConversationLatestMessage = {
  messageId: string,
  kind: string,
  text: string,
  meta?: string | null
};

export type AgentConversationMeta = {
  agentId: string,
  slug: string,
  headline?: string | null,
  category?: {
    categoryId: string,
    slug: string,
    name: string
  } | null,
  provider?: {
    providerId: string,
    displayName: string,
    verificationStatus?: string
  } | null,
  demoTurnLimit?: number | null,
  engagement?: {
    engagementId: string,
    conversationId?: string,
    state?: string,
    turnUsage?: number,
    paidTurnCount?: number,
    remainingTurns?: number,
    latestSummary?: string | null,
    latestTitle?: string | null,
    updatedAt?: string | null
  } | null,
  checkoutIntent?: {
    checkoutIntentId: string,
    state?: string,
    priceMinor?: number | null,
    currency?: string | null,
    pricingModel?: string | null
  } | null,
  checkoutSession?: {
    checkoutSessionId: string,
    state?: string,
    paymentMethod?: string | null,
    providerName?: string | null
  } | null,
  hasPaidEntitlement?: boolean
};

export type ConversationSummary = {
  conversationId: string,
  conversationKind: 'agent' | 'direct' | 'group',
  title: string,
  participants: ConversationParticipant[],
  latestMessage?: ConversationLatestMessage | null,
  unreadCount?: number,
  draft?: string | null,
  updatedAt?: string | null,
  agentMeta?: AgentConversationMeta | null
};

export type ConversationDetail = ConversationSummary & {
  transcript?: ConversationMessage[]
};

export type ConversationMessage = {
  messageId: string,
  conversationId: string,
  authorType: 'agent' | 'system' | 'user',
  authorName: string,
  kind: string,
  text: string,
  createdAt?: string | null,
  meta?: string | null
};

export type ConversationProfile = {
  participantId: string,
  participantType: 'user' | 'agent',
  displayName: string,
  avatarLabel?: string | null,
  headline?: string | null,
  description?: string | null,
  category?: AgentConversationMeta['category'],
  provider?: AgentConversationMeta['provider'],
  demoTurnLimit?: number | null,
  pricingModel?: string | null,
  priceMinor?: number | null,
  currency?: string | null,
  state?: string | null,
  latestSummary?: string | null,
  updatedAt?: string | null,
  billing?: {
    hasPaidEntitlement?: boolean,
    checkoutIntent?: AgentConversationMeta['checkoutIntent'],
    checkoutSession?: AgentConversationMeta['checkoutSession'],
  },
  capabilities?: Array<{
    capabilityKey?: string,
    capabilityValue?: unknown
  }>
};

export const resolveConversationsBaseUrl = resolvePlatformApiBaseUrl;

export async function fetchConversationSummaries(options?: {kind?: string}) {
  const searchParams = new URLSearchParams();
  if(options?.kind) {
    searchParams.set('kind', options.kind);
  }

  const suffix = searchParams.size ? `?${searchParams.toString()}` : '';
  const payload = await fetchConversationJson<{ok: boolean, conversations?: ConversationSummary[]}>(`/conversations${suffix}`);
  return Array.isArray(payload.conversations) ? payload.conversations : [];
}

export async function fetchConversationDetail(conversationId: string) {
  const trimmedId = conversationId.trim();
  if(!trimmedId) {
    throw new Error('Conversation id is empty');
  }

  const payload = await fetchConversationJson<{ok: boolean, conversation?: ConversationDetail}>(`/conversations/${encodeURIComponent(trimmedId)}`);
  if(!payload.conversation) {
    throw new Error('Conversation detail is missing');
  }

  return payload.conversation;
}

export async function fetchConversationMessages(conversationId: string) {
  const trimmedId = conversationId.trim();
  if(!trimmedId) {
    throw new Error('Conversation id is empty');
  }

  const payload = await fetchConversationJson<{ok: boolean, messages?: ConversationMessage[]}>(`/conversations/${encodeURIComponent(trimmedId)}/messages`);
  return Array.isArray(payload.messages) ? payload.messages : [];
}

export async function fetchConversationProfile(conversationId: string) {
  const trimmedId = conversationId.trim();
  if(!trimmedId) {
    throw new Error('Conversation id is empty');
  }

  const payload = await fetchConversationJson<{ok: boolean, profile?: ConversationProfile}>(`/conversations/${encodeURIComponent(trimmedId)}/profile`);
  if(!payload.profile) {
    throw new Error('Conversation profile is missing');
  }

  return payload.profile;
}

export async function sendConversationMessage(conversationId: string, text: string) {
  const trimmedId = conversationId.trim();
  const trimmedText = text.trim();
  if(!trimmedId) {
    throw new Error('Conversation id is empty');
  }
  if(!trimmedText) {
    throw new Error('Message text is empty');
  }

  const baseUrl = resolvePlatformApiBaseUrl();
  if(!baseUrl) {
    throw new Error('Platform API URL is not configured');
  }

  const payload = await fetchPlatformJson<{
    ok?: boolean,
    error?: string,
    message?: string,
    conversation?: ConversationSummary,
    messages?: ConversationMessage[]
  }>(`/conversations/${encodeURIComponent(trimmedId)}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({text: trimmedText})
  });

  return payload;
}

async function fetchConversationJson<T>(pathname: string) {
  return fetchPlatformJson<T>(pathname);
}
