import type {AgentRegistryAgentDetail} from '@lib/agentRegistry';
import type {
  ConversationMessage,
  ConversationProfile,
  ConversationSummary
} from '@lib/conversations';
import type {
  AgentMarketplaceCheckoutIntent,
  AgentMarketplaceCheckoutSession,
  AgentMarketplaceDemoEngagement
} from '@lib/agentMarketplaceDemo';

export type ConversationTimelineItem =
  | {
    kind: 'description',
    title: string,
    subtitle?: string | null,
    bullets?: string[]
  }
  | {
    kind: 'message',
    side: 'left' | 'right' | 'center',
    author?: string,
    lines: string[],
    timestamp?: string | null
  }
  | {
    kind: 'service',
    lines: string[]
  };

export type ConversationActionIntent =
  | 'start_demo'
  | 'advance_demo'
  | 'prepare_upgrade'
  | 'open_checkout'
  | 'start_paid'
  | 'continue_paid';

export type ConversationActionDefinition = {
  intent: ConversationActionIntent,
  label: string,
  row: 'primary' | 'secondary'
};

type ConversationTimelineOptions = {
  conversation: ConversationSummary,
  profile: ConversationProfile | null,
  agent?: AgentRegistryAgentDetail,
  messages: ConversationMessage[],
  demo: AgentMarketplaceDemoEngagement | null,
  checkoutIntent: AgentMarketplaceCheckoutIntent | null,
  checkoutSession: AgentMarketplaceCheckoutSession | null
};

export function buildConversationTimeline(options: ConversationTimelineOptions) {
  const items: ConversationTimelineItem[] = [];

  if(options.agent) {
    items.push({
      kind: 'description',
      title: options.agent.name,
      subtitle: options.agent.headline || options.agent.description || null,
      bullets: [
        options.agent.category?.name,
        options.agent.provider?.displayName,
        options.agent.demoTurnLimit ? `데모 ${options.agent.demoTurnLimit}턴` : null
      ].filter(Boolean) as string[]
    });
  } else if(options.profile) {
    items.push({
      kind: 'description',
      title: options.profile.displayName,
      subtitle: options.profile.headline || options.profile.description || null
    });
  }

  const transcript = [...options.messages];
  if(options.demo && !transcript.some((item) => item.kind === 'state')) {
    transcript.push({
      messageId: `${options.demo.engagementId}:live-state`,
      conversationId: options.conversation.conversationId,
      authorType: 'system',
      authorName: '현재 상태',
      kind: 'state',
      text: `${options.conversation.title}와의 대화 상태가 이어지고 있어.`,
      meta: [
        options.demo.state === 'paid_active' ? '정식 플로우 진행 중' : '데모 진행 중',
        options.demo.remainingTurns !== undefined ? `남은 ${options.demo.remainingTurns}턴` : null,
        options.demo.turnUsage !== undefined ? `사용 ${options.demo.turnUsage}턴` : null
      ].filter(Boolean).join(' · ') || null,
      createdAt: options.conversation.updatedAt || null
    });
  }

  for(const message of transcript) {
    const side = message.authorType === 'user' ? 'right' : message.authorType === 'agent' ? 'left' : 'center';
    let lines: string[];
    if(message.meta && side !== 'center') {
      lines = [message.text, message.meta];
    } else {
      lines = [message.text, side === 'center' ? message.meta : null].filter(Boolean) as string[];
    }

    items.push({
      kind: 'message',
      side,
      author: message.authorName,
      lines,
      timestamp: message.createdAt || null
    });
  }

  if(!transcript.length) {
    items.push({
      kind: 'description',
      title: `${options.conversation.title}는 아직 시작 전이야.`,
      subtitle: '바로 메시지를 보내거나 데모를 시작할 수 있어.'
    });
  }

  if(options.checkoutIntent && !transcript.some((item) => item.kind === 'checkout_intent')) {
    items.push({
      kind: 'service',
      lines: [[
        '결제 준비됨',
        options.checkoutIntent.priceMinor ? `${options.checkoutIntent.priceMinor.toLocaleString()} ${options.checkoutIntent.currency || 'KRW'}` : null,
        options.checkoutIntent.pricingModel || null
      ].filter(Boolean).join(' · ')]
    });
  }

  if(options.checkoutSession && !transcript.some((item) => item.kind === 'checkout_session')) {
    items.push({
      kind: 'service',
      lines: [[
        options.checkoutSession.state === 'paid' ? '결제 완료됨' : '결제 안내 열림',
        options.checkoutSession.paymentMethod || null,
        options.checkoutSession.providerName || null
      ].filter(Boolean).join(' · ')]
    });
  }

  return items;
}

export function buildConversationActionDefinitions(options: {
  demo: AgentMarketplaceDemoEngagement | null,
  checkoutIntent: AgentMarketplaceCheckoutIntent | null,
  checkoutSession: AgentMarketplaceCheckoutSession | null
}) {
  const actions: ConversationActionDefinition[] = [{
    intent: 'start_demo',
    label: options.demo ? '대화 다시 열기' : '데모 시작',
    row: 'primary'
  }];

  if(options.demo && options.demo.state !== 'paid_active') {
    actions.push({
      intent: options.demo.remainingTurns === 0 ? 'prepare_upgrade' : 'advance_demo',
      label: options.demo.remainingTurns === 0 ? '유료 전환 준비' : '다음 턴 진행',
      row: 'primary'
    });
  }

  if(options.checkoutIntent) {
    actions.push({
      intent: 'open_checkout',
      label: options.checkoutSession ? '결제 안내 다시 보기' : '결제 안내 보기',
      row: 'secondary'
    });
  }

  if(options.demo && options.checkoutSession?.state === 'paid') {
    actions.push({
      intent: 'start_paid',
      label: options.demo.state === 'paid_active' ? '정식 플로우 다시 열기' : '정식 플로우 시작',
      row: 'secondary'
    });
  }

  if(options.demo?.state === 'paid_active') {
    actions.push({
      intent: 'continue_paid',
      label: '다음 정식 초안',
      row: 'secondary'
    });
  }

  return actions;
}
