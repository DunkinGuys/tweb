import {
  fetchConversationDetail,
  fetchConversationMessages,
  fetchConversationProfile,
  fetchConversationSummaries,
  resolveConversationsBaseUrl,
  sendConversationMessage
} from '@lib/conversations';

describe('conversations', () => {
  const originalLocation = window.location;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('http://localhost:8080/')
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
    globalThis.fetch = originalFetch;
  });

  test('falls back to localhost platform api in local dev', () => {
    expect(resolveConversationsBaseUrl()).toBe('http://127.0.0.1:8799');
  });

  test('fetches conversation summaries, detail, messages, and profile', async() => {
    vi.stubEnv('VITE_PLATFORM_API_URL', 'https://api.luminite.io');

    const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      conversations: [{
        conversationId: 'agent:yeon',
        conversationKind: 'agent',
        title: '연이'
      }]
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      conversation: {
        conversationId: 'agent:yeon',
        conversationKind: 'agent',
        title: '연이'
      }
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      messages: [{
        messageId: 'agent_yeon:intro',
        conversationId: 'agent:yeon',
        authorType: 'agent',
        authorName: '연이',
        kind: 'intro',
        text: '안녕'
      }]
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      profile: {
        participantId: 'agent_yeon',
        participantType: 'agent',
        displayName: '연이',
        state: 'paid_active'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const conversations = await fetchConversationSummaries({kind: 'agent'});
    const detail = await fetchConversationDetail('agent:yeon');
    const messages = await fetchConversationMessages('agent:yeon');
    const profile = await fetchConversationProfile('agent:yeon');

    expect(conversations[0]?.conversationId).toBe('agent:yeon');
    expect(detail.title).toBe('연이');
    expect(messages[0]?.text).toBe('안녕');
    expect(profile.displayName).toBe('연이');
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.luminite.io/conversations?kind=agent');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.luminite.io/conversations/agent%3Ayeon');
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.luminite.io/conversations/agent%3Ayeon/messages');
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'https://api.luminite.io/conversations/agent%3Ayeon/profile');
  });

  test('posts a conversation message', async() => {
    vi.stubEnv('VITE_PLATFORM_API_URL', 'https://api.luminite.io');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      conversation: {
        conversationId: 'agent:yeon',
        title: '연이'
      },
      messages: [{
        messageId: 'msg_user_1',
        conversationId: 'agent:yeon',
        authorType: 'user',
        authorName: '나',
        kind: 'user_text',
        text: '안녕'
      }]
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const payload = await sendConversationMessage('agent:yeon', '안녕');

    expect(payload.messages?.[0]?.text).toBe('안녕');
    expect(fetchMock).toHaveBeenCalledWith('https://api.luminite.io/conversations/agent%3Ayeon/messages', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({text: '안녕'})
    });
  });

  test('supports direct conversations on the same contract', async() => {
    vi.stubEnv('VITE_PLATFORM_API_URL', 'https://api.luminite.io');

    const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      conversations: [{
        conversationId: 'direct:user_minho',
        conversationKind: 'direct',
        title: '민호'
      }]
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      conversation: {
        conversationId: 'direct:user_minho',
        conversationKind: 'direct',
        title: '민호'
      }
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      profile: {
        participantId: 'user_minho',
        participantType: 'user',
        displayName: '민호',
        headline: '가볍게 툭툭 연락하는 친구'
      }
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      messages: [{
        messageId: 'msg_direct_minho_1',
        conversationId: 'direct:user_minho',
        authorType: 'user',
        authorName: '민호',
        kind: 'text',
        text: '오늘 저녁에 시간 되면 얘기 좀 하자.'
      }]
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      conversation: {
        conversationId: 'direct:user_minho',
        conversationKind: 'direct',
        title: '민호'
      },
      messages: [{
        messageId: 'msg_direct_me_2',
        conversationId: 'direct:user_minho',
        authorType: 'user',
        authorName: '나',
        kind: 'text',
        text: '좋아'
      }]
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const conversations = await fetchConversationSummaries({kind: 'direct'});
    const detail = await fetchConversationDetail('direct:user_minho');
    const profile = await fetchConversationProfile('direct:user_minho');
    const messages = await fetchConversationMessages('direct:user_minho');
    const sendPayload = await sendConversationMessage('direct:user_minho', '좋아');

    expect(conversations[0]?.conversationKind).toBe('direct');
    expect(detail.title).toBe('민호');
    expect(profile.participantType).toBe('user');
    expect(messages[0]?.authorName).toBe('민호');
    expect(sendPayload.messages?.[0]?.text).toBe('좋아');
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.luminite.io/conversations?kind=direct');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.luminite.io/conversations/direct%3Auser_minho');
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.luminite.io/conversations/direct%3Auser_minho/profile');
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'https://api.luminite.io/conversations/direct%3Auser_minho/messages');
    expect(fetchMock).toHaveBeenNthCalledWith(5, 'https://api.luminite.io/conversations/direct%3Auser_minho/messages', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({text: '좋아'})
    });
  });
});
