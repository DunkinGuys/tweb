import type {MyMessage, MessagesStorage} from '@appManagers/appMessagesManager';
import type {AppManagers} from '@lib/managers';
import type {User} from '@layer';
import type {ConversationMainChatViewModel} from '@lib/conversationMainChatViewModel';
import SlicedArray, {SliceEnd} from '@helpers/slicedArray';

export type ConversationSyntheticMessageSeed = {
  seedId: string,
  kind: 'message' | 'service',
  out: boolean,
  authorName?: string,
  text: string,
  timestamp?: number | null
};

export function buildConversationSyntheticMessageSeeds(viewModel: ConversationMainChatViewModel) {
  const seeds: ConversationSyntheticMessageSeed[] = [];

  viewModel.timelineItems.forEach((item, index) => {
    if(item.kind === 'description') {
      const lines = [
        item.title,
        item.subtitle,
        ...(item.bullets || [])
      ].filter(Boolean);

      seeds.push({
        seedId: `description:${index}`,
        kind: 'service',
        out: false,
        text: lines.join('\n'),
        timestamp: null
      });
      return;
    }

    if(item.kind === 'service') {
      seeds.push({
        seedId: `service:${index}`,
        kind: 'service',
        out: false,
        text: item.lines.join('\n'),
        timestamp: null
      });
      return;
    }

    seeds.push({
      seedId: `message:${index}`,
      kind: item.side === 'center' ? 'service' : 'message',
      out: item.side === 'right',
      authorName: item.author,
      text: item.lines.join('\n'),
      timestamp: item.timestamp ? new Date(item.timestamp).getTime() : null
    });
  });

  return seeds;
}

export function resolveConversationSyntheticPeerId(seedKey: string): PeerId {
  let hash = 0;
  for(let i = 0; i < seedKey.length; i++) {
    hash = ((hash * 31) + seedKey.charCodeAt(i)) % 100000000;
  }

  return 1700000000 + hash;
}

export async function materializeConversationSyntheticMessages(options: {
  managers: AppManagers,
  peerId: PeerId,
  displayName: string,
  seeds: ConversationSyntheticMessageSeed[],
  isBot?: boolean
}): Promise<MyMessage[]> {
  ensureSyntheticConversationPeer(options.managers, options.peerId, options.displayName, options.isBot);

  const storage = createSyntheticStorage(options.peerId);
  const myPeerId = options.managers.appPeersManager.peerId;
  const remoteOutputPeer = options.managers.appPeersManager.getOutputPeer(options.peerId);
  const myOutputPeer = options.managers.appPeersManager.getOutputPeer(myPeerId);

  const messages = options.seeds.map((seed, index) => ({
    _: 'message' as const,
    id: -Math.abs(index + 1),
    peer_id: remoteOutputPeer,
    from_id: seed.out ? myOutputPeer : remoteOutputPeer,
    pFlags: {
      local: true,
      out: seed.out || undefined
    },
    date: Math.floor((seed.timestamp || Date.now()) / 1000),
    message: seed.authorName ? `${seed.authorName}\n${seed.text}` : seed.text
  }));

  const savedMessages = await options.managers.appMessagesManager.saveMessages(messages, {storage});
  return savedMessages as MyMessage[];
}

export async function materializeConversationChatHistory(options: {
  managers: AppManagers,
  peerId: PeerId,
  displayName: string,
  seeds: ConversationSyntheticMessageSeed[],
  isBot?: boolean
}): Promise<MyMessage[]> {
  ensureSyntheticConversationPeer(options.managers, options.peerId, options.displayName, options.isBot);

  const storage = await options.managers.appMessagesManager.getHistoryMessagesStorage(options.peerId);
  const historyStorage = await options.managers.appMessagesManager.getHistoryStorage(options.peerId);
  storage.clear();
  resetHistoryStorage(historyStorage);

  const messages = await materializeConversationSyntheticMessages({
    ...options,
    managers: options.managers
  });
  messages.forEach((message) => {
    storage.set(message.mid, message);
  });

  const mids = messages.map((message) => message.mid).sort((a, b) => b - a);
  historyStorage.history.insertSlice(mids);
  historyStorage.history.first.setEnd(SliceEnd.Both);
  historyStorage.count = mids.length;
  historyStorage._maxId = mids[0];
  historyStorage.wasFetched = true;

  return messages;
}

function ensureSyntheticConversationPeer(managers: AppManagers, peerId: PeerId, displayName: string, isBot?: boolean) {
  if(!peerId.isUser() || managers.appUsersManager.hasUser(peerId.toUserId())) {
    return;
  }

  const user: User.user = {
    _: 'user',
    id: peerId.toUserId(),
    access_hash: '0',
    first_name: displayName,
    pFlags: {
      bot: isBot || undefined
    }
  };

  managers.appUsersManager.saveApiUsers([user]);
}

function createSyntheticStorage(peerId: PeerId) {
  const storage = new Map() as MessagesStorage;
  storage.peerId = peerId;
  storage.type = 'history';
  storage.key = `${peerId}_history`;
  return storage;
}

function resetHistoryStorage(historyStorage: Awaited<ReturnType<AppManagers['appMessagesManager']['getHistoryStorage']>>) {
  historyStorage.history = new SlicedArray<number>();
  historyStorage.count = null;
  historyStorage._maxId = undefined;
  historyStorage.wasFetched = false;
}
