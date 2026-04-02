import {
  fetchAgentRegistryAgentDetail,
  type AgentRegistryAgentDetail
} from '@lib/agentRegistry';
import {
  fetchConversationDetail,
  fetchConversationMessages,
  fetchConversationProfile,
  type ConversationMessage,
  type ConversationParticipant,
  type ConversationProfile,
  type ConversationSummary
} from '@lib/conversations';
import {
  fetchCurrentAgentMarketplaceCheckoutSession,
  fetchCurrentAgentMarketplaceDemo,
  fetchCurrentAgentMarketplaceUpgradeIntent,
  type AgentMarketplaceCheckoutIntent,
  type AgentMarketplaceCheckoutSession,
  type AgentMarketplaceDemoEngagement
} from '@lib/agentMarketplaceDemo';

export type ConversationMainChatTarget = {
  conversationId?: string,
  agentSlug?: string
};

export type ConversationMainChatState = {
  conversation: ConversationSummary,
  conversationId: string,
  profile: ConversationProfile | null,
  agent?: AgentRegistryAgentDetail,
  messages: ConversationMessage[],
  demo: AgentMarketplaceDemoEngagement | null,
  checkoutIntent: AgentMarketplaceCheckoutIntent | null,
  checkoutSession: AgentMarketplaceCheckoutSession | null
};

export async function loadConversationMainChatState(target: ConversationMainChatTarget): Promise<ConversationMainChatState> {
  const trimmedConversationId = target.conversationId?.trim();
  const trimmedSlug = target.agentSlug?.trim();

  if(!trimmedConversationId && !trimmedSlug) {
    throw new Error('Conversation target is empty');
  }

  const currentConversation = trimmedConversationId ? await fetchConversationDetail(trimmedConversationId).catch((): null => null) : null;
  const resolvedSlug = trimmedSlug || currentConversation?.agentMeta?.slug;
  const conversationId = currentConversation?.conversationId || trimmedConversationId || '';
  const [profile, agent] = await Promise.all([
    conversationId ? fetchConversationProfile(conversationId).catch((): null => null) : Promise.resolve(null),
    resolvedSlug ? fetchAgentRegistryAgentDetail(resolvedSlug).catch((): null => null) : Promise.resolve(null)
  ]);

  const [messages, demo, checkoutIntent, checkoutSession] = await Promise.all([
    conversationId ? fetchConversationMessages(conversationId).catch((): ConversationMessage[] => []) : Promise.resolve([]),
    agent ? fetchCurrentAgentMarketplaceDemo(agent).catch((): null => null) : Promise.resolve(null),
    agent ? fetchCurrentAgentMarketplaceUpgradeIntent(agent).catch((): null => null) : Promise.resolve(null),
    agent ? fetchCurrentAgentMarketplaceCheckoutSession(agent).catch((): null => null) : Promise.resolve(null)
  ]);

  const conversation = currentConversation ?? {
    conversationId: conversationId || `agent:${agent?.slug || resolvedSlug}`,
    conversationKind: agent ? 'agent' : 'direct',
    title: agent?.name || profile?.displayName || '대화',
    participants: [] as ConversationParticipant[],
    agentMeta: agent ? {
      agentId: agent.agentId,
      slug: agent.slug,
      headline: agent.headline || null,
      category: agent.category || null,
      provider: agent.provider || null,
      demoTurnLimit: agent.demoTurnLimit ?? null
    } : null
  } satisfies ConversationSummary;

  return {
    conversation,
    conversationId: conversation.conversationId,
    profile,
    agent: agent || undefined,
    messages,
    demo,
    checkoutIntent,
    checkoutSession
  };
}

export function buildConversationMainChatMeta(state: ConversationMainChatState) {
  const shared = [
    state.conversation.updatedAt ? `최근 활동 ${formatConversationTime(state.conversation.updatedAt)}` : null
  ];

  if(state.agent) {
    return [
      state.agent.category?.name || null,
      state.demo?.state === 'paid_active' ? '정식 대화 중' : state.demo ? '데모 진행 중' : '대화 시작 전',
      state.demo?.remainingTurns !== undefined ? `남은 ${state.demo.remainingTurns}턴` : null,
      state.checkoutSession?.state === 'paid' ? '결제 완료' : null,
      ...shared
    ].filter(Boolean).join(' · ');
  }

  return [
    state.profile?.headline || '일반 대화',
    ...shared
  ].filter(Boolean).join(' · ');
}

function formatConversationTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}
