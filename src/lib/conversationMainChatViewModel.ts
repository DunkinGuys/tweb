import type {ConversationMainChatState} from '@lib/conversationMainChatModel';
import {buildConversationMainChatMeta} from '@lib/conversationMainChatModel';
import {
  buildConversationActionDefinitions,
  buildConversationTimeline,
  type ConversationActionDefinition,
  type ConversationTimelineItem
} from '@lib/conversationMainChatTimeline';
import {
  buildConversationSyntheticMessageSeeds,
  type ConversationSyntheticMessageSeed
} from '@lib/conversationSyntheticMessagesAdapter';

export type ConversationMainChatViewModel = {
  title: string,
  meta: string,
  avatarLabel: string,
  avatarBackground: string,
  timelineItems: ConversationTimelineItem[],
  actionDefinitions: ConversationActionDefinition[],
  syntheticMessageSeeds: ConversationSyntheticMessageSeed[]
};

export function buildConversationMainChatViewModel(state: ConversationMainChatState): ConversationMainChatViewModel {
  const title = state.conversation.title || state.profile?.displayName || state.agent?.name || '대화';
  const avatarLabelSource = [
    state.profile?.avatarLabel,
    state.conversation.participants[0]?.avatarLabel,
    state.profile?.displayName,
    state.conversation.title,
    state.agent?.name,
    '?'
  ].find(Boolean) as string;
  let avatarBackground = 'linear-gradient(135deg, rgba(148, 163, 184, 0.22), rgba(100, 116, 139, 0.18))';
  if(state.agent) {
    avatarBackground = 'linear-gradient(135deg, rgba(94, 234, 212, 0.22), rgba(56, 189, 248, 0.18))';
  }

  const timelineItems = buildConversationTimeline({
    conversation: state.conversation,
    profile: state.profile,
    agent: state.agent,
    messages: state.messages,
    demo: state.demo,
    checkoutIntent: state.checkoutIntent,
    checkoutSession: state.checkoutSession
  });

  const actionDefinitions = buildConversationActionDefinitions({
    demo: state.demo,
    checkoutIntent: state.checkoutIntent,
    checkoutSession: state.checkoutSession
  });

  const viewModel: ConversationMainChatViewModel = {
    title,
    meta: buildConversationMainChatMeta(state),
    avatarLabel: avatarLabelSource.trim().slice(0, 1).toUpperCase(),
    avatarBackground,
    timelineItems,
    actionDefinitions,
    syntheticMessageSeeds: []
  };

  viewModel.syntheticMessageSeeds = buildConversationSyntheticMessageSeeds(viewModel);
  return viewModel;
}
