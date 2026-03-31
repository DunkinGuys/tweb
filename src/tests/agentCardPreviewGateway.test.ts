import {
  approveAgentCardPreviewForCurrentChat,
  canUseAgentCardPreviewGateway,
  cancelAgentCardPreviewForCurrentChat,
  fetchAgentCardPreviewReply,
  getAgentCardPreviewRuntimeContext,
  requestAgentCardPreviewEvent,
  requestAgentCardPreviewProposal,
  resolveAgentCardPreviewGatewayBaseUrl
} from '@lib/agentCardPreviewGateway';

describe('agentCardPreviewGateway', () => {
  const originalLocation = window.location;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.localStorage.clear();
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

  test('falls back to localhost gateway base url in local dev', () => {
    expect(resolveAgentCardPreviewGatewayBaseUrl()).toBe('http://127.0.0.1:8788');
    expect(canUseAgentCardPreviewGateway()).toBe(true);
  });

  test('accepts full proposal endpoint env values and stored runtime context', () => {
    vi.stubEnv('VITE_AGENT_CARD_PREVIEW_GATEWAY_URL', 'http://127.0.0.1:8788/agent-card-preview-proposal');
    window.localStorage.setItem('agent-card-preview-runtime-context', JSON.stringify({
      kakaoId: 'test-kakao-id',
      platform: 'kakao'
    }));

    expect(resolveAgentCardPreviewGatewayBaseUrl()).toBe('http://127.0.0.1:8788');
    expect(getAgentCardPreviewRuntimeContext()).toEqual({
      kakaoId: 'test-kakao-id',
      platform: 'kakao'
    });
  });

  test('prefers window gateway base url override when present', () => {
    vi.stubEnv('VITE_AGENT_CARD_PREVIEW_GATEWAY_URL', 'http://127.0.0.1:8788');
    (window as typeof window & {
      __agentCardPreviewGatewayBaseUrl?: string
    }).__agentCardPreviewGatewayBaseUrl = 'http://127.0.0.1:9999/agent-card-preview-proposal';

    expect(resolveAgentCardPreviewGatewayBaseUrl()).toBe('http://127.0.0.1:9999');

    delete (window as typeof window & {
      __agentCardPreviewGatewayBaseUrl?: string
    }).__agentCardPreviewGatewayBaseUrl;
  });

  test('posts proposal requests with trimmed text and runtime context', async() => {
    vi.stubEnv('VITE_AGENT_CARD_PREVIEW_GATEWAY_URL', 'http://127.0.0.1:8788');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      proposalId: 'proposal_123',
      source: 'agent-gateway',
      payload: {
        title: '연이가 답장을 준비했어',
        status: 'PROPOSED'
      }
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await requestAgentCardPreviewProposal('  hello gateway  ', {kakaoId: 'kakao-user'});

    expect(response.proposalId).toBe('proposal_123');
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8788/agent-card-preview-proposal', expect.objectContaining({
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        inputText: 'hello gateway',
        runtimeContext: {
          kakaoId: 'kakao-user'
        }
      })
    }));
  });

  test('uses env runtime kakao id when local storage is empty', () => {
    vi.stubEnv('VITE_AGENT_CARD_RUNTIME_KAKAO_ID', 'env-kakao-id');

    expect(getAgentCardPreviewRuntimeContext()).toEqual({
      kakaoId: 'env-kakao-id'
    });
  });

  test('posts approved events with current chat context and fills composer with reply draft', async() => {
    vi.stubEnv('VITE_AGENT_CARD_PREVIEW_GATEWAY_URL', 'http://127.0.0.1:8788');
    document.body.innerHTML = '<div class="input-message-input"></div>';
    (window as typeof window & {
      appImManager?: unknown
    }).appImManager = {
      chat: {
        peerId: 123,
        threadId: 456,
        monoforumThreadId: 789
      }
    };

    const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ok: true}), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      proposalId: 'proposal_approved',
      reply: {
        text: 'reply draft text',
        summary: 'reply draft summary'
      }
    }), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    const response = await approveAgentCardPreviewForCurrentChat('proposal_approved', {
      applyReplyToComposer: true
    });

    expect(response.reply?.text).toBe('reply draft text');
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8788/agent-card-preview-event', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        proposalId: 'proposal_approved',
        event: 'approved',
        peerId: 123,
        threadId: 456,
        monoforumThreadId: 789
      })
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8788/agent-card-preview-replies?proposalId=proposal_approved');
    expect(document.querySelector('.input-message-input')?.textContent).toBe('reply draft text');
  });

  test('supports explicit event and reply helpers', async() => {
    vi.stubEnv('VITE_AGENT_CARD_PREVIEW_GATEWAY_URL', 'http://127.0.0.1:8788');

    const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ok: true}), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      ok: true,
      proposalId: 'proposal_cancelled',
      reply: null
    }), {status: 200}))
    .mockResolvedValueOnce(new Response(JSON.stringify({ok: true}), {status: 200}));
    globalThis.fetch = fetchMock as typeof fetch;

    await requestAgentCardPreviewEvent('proposal_cancelled', 'ui_action', {
      actionId: 'proposal_cancelled:action:1',
      actionType: 'copy',
      actionLabel: '답장 복사'
    });
    const reply = await fetchAgentCardPreviewReply('proposal_cancelled');
    await cancelAgentCardPreviewForCurrentChat('proposal_cancelled');

    expect(reply.reply).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8788/agent-card-preview-event', expect.objectContaining({
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        proposalId: 'proposal_cancelled',
        event: 'ui_action',
        peerId: 123,
        threadId: 456,
        monoforumThreadId: 789,
        actionId: 'proposal_cancelled:action:1',
        actionType: 'copy',
        actionLabel: '답장 복사'
      })
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:8788/agent-card-preview-event', expect.objectContaining({
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        proposalId: 'proposal_cancelled',
        event: 'cancelled',
        peerId: 123,
        threadId: 456,
        monoforumThreadId: 789
      })
    }));
  });
});
