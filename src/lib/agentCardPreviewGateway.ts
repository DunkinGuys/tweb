import placeCaretAtEnd from '@helpers/dom/placeCaretAtEnd';
import {pushAgentCardPreviewToCurrentChat, type AgentCardPreviewPayload} from '@lib/agentCardPreviewBridge';

export type AgentCardPreviewRuntimeContext = Record<string, unknown>;

export type AgentCardPreviewProposalResponse = {
  ok: boolean,
  proposalId?: string,
  source?: string,
  payload?: AgentCardPreviewPayload,
  error?: string,
  message?: string
};

export type AgentCardPreviewEvent = 'approved' | 'cancelled' | 'ui_action';

export type AgentCardPreviewEventResponse = {
  ok: boolean,
  error?: string,
  message?: string
};

export type AgentCardPreviewReplyDraft = {
  createdAt?: string,
  text?: string,
  summary?: string,
  details?: Record<string, unknown>
};

export type AgentCardPreviewReplyResponse = {
  ok: boolean,
  proposalId?: string,
  reply?: AgentCardPreviewReplyDraft | null,
  error?: string,
  message?: string
};

const LOCALHOST_GATEWAY_BASE_URL = 'http://127.0.0.1:8788';
const PROPOSAL_PATH = '/agent-card-preview-proposal';
const EVENT_PATH = '/agent-card-preview-event';
const REPLY_PATH = '/agent-card-preview-replies';
const RUNTIME_CONTEXT_STORAGE_KEY = 'agent-card-preview-runtime-context';
const RUNTIME_KAKAO_ID_STORAGE_KEY = 'agent-card-preview-kakao-id';

export function canUseAgentCardPreviewGateway() {
  return !!resolveAgentCardPreviewGatewayBaseUrl();
}

export function resolveAgentCardPreviewGatewayBaseUrl() {
  const windowOverride = readWindowGatewayBaseUrl();
  if(windowOverride) {
    return windowOverride;
  }

  const configuredUrl = normalizeGatewayBaseUrl(import.meta.env.VITE_AGENT_CARD_PREVIEW_GATEWAY_URL);
  if(configuredUrl) {
    return configuredUrl;
  }

  if(typeof window === 'undefined') {
    return null;
  }

  return isLocalDevHost(window.location.hostname) ? LOCALHOST_GATEWAY_BASE_URL : null;
}

export function getAgentCardPreviewRuntimeContext() {
  const storedContext = readStoredRuntimeContext();
  if(storedContext) {
    return storedContext;
  }

  if(import.meta.env.VITE_AGENT_CARD_RUNTIME_KAKAO_ID) {
    return {
      kakaoId: import.meta.env.VITE_AGENT_CARD_RUNTIME_KAKAO_ID
    };
  }

  return undefined;
}

export async function requestAgentCardPreviewProposal(
  inputText: string,
  runtimeContext = getAgentCardPreviewRuntimeContext()
) {
  const baseUrl = resolveAgentCardPreviewGatewayBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent Card preview gateway URL is not configured');
  }

  const trimmedInputText = inputText.trim();
  if(!trimmedInputText) {
    throw new Error('Agent Card preview input is empty');
  }

  const response = await fetch(`${baseUrl}${PROPOSAL_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      inputText: trimmedInputText,
      ...(runtimeContext ? {runtimeContext} : {})
    })
  });

  const payload = await parseJsonResponse<AgentCardPreviewProposalResponse>(response);
  if(!response.ok || !payload.ok || !payload.payload) {
    throw new Error(payload.message || payload.error || `Agent Card preview request failed with status ${response.status}`);
  }

  return payload;
}

export async function showAgentCardPreviewForCurrentChat(
  inputText: string,
  runtimeContext = getAgentCardPreviewRuntimeContext()
) {
  const response = await requestAgentCardPreviewProposal(inputText, runtimeContext);
  const previewPayload: AgentCardPreviewPayload = {
    ...response.payload,
    sourceProposalId: response.payload.sourceProposalId || response.proposalId
  };

  const ok = pushAgentCardPreviewToCurrentChat(previewPayload, response.source || 'agent-gateway');
  if(!ok) {
    throw new Error('Unable to mount Agent Card preview into the current chat');
  }

  return {
    ...response,
    payload: previewPayload
  };
}

export async function requestAgentCardPreviewEvent(
  proposalId: string,
  event: AgentCardPreviewEvent,
  options?: {
    actionId?: string,
    actionType?: string,
    actionLabel?: string,
    runtimeContext?: AgentCardPreviewRuntimeContext
  }
) {
  const baseUrl = resolveAgentCardPreviewGatewayBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent Card preview gateway URL is not configured');
  }

  const trimmedProposalId = proposalId.trim();
  if(!trimmedProposalId) {
    throw new Error('Agent Card preview proposalId is empty');
  }

  const chatContext = getCurrentChatContext();
  const runtimeContext = options?.runtimeContext || getAgentCardPreviewRuntimeContext();
  const response = await fetch(`${baseUrl}${EVENT_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      proposalId: trimmedProposalId,
      event,
      ...(runtimeContext ? {runtimeContext} : {}),
      ...(chatContext || {}),
      ...(options?.actionId ? {actionId: options.actionId} : {}),
      ...(options?.actionType ? {actionType: options.actionType} : {}),
      ...(options?.actionLabel ? {actionLabel: options.actionLabel} : {})
    })
  });

  const payload = await parseJsonResponse<AgentCardPreviewEventResponse>(response);
  if(!response.ok || !payload.ok) {
    throw new Error(payload.message || payload.error || `Agent Card preview event request failed with status ${response.status}`);
  }

  return payload;
}

export async function fetchAgentCardPreviewReply(proposalId: string) {
  const baseUrl = resolveAgentCardPreviewGatewayBaseUrl();
  if(!baseUrl) {
    throw new Error('Agent Card preview gateway URL is not configured');
  }

  const response = await fetch(`${baseUrl}${REPLY_PATH}?proposalId=${encodeURIComponent(proposalId)}`);
  const payload = await parseJsonResponse<AgentCardPreviewReplyResponse>(response);
  if(!response.ok || !payload.ok) {
    throw new Error(payload.message || payload.error || `Agent Card preview reply request failed with status ${response.status}`);
  }

  return payload;
}

export async function approveAgentCardPreviewForCurrentChat(
  proposalId: string,
  options?: {
    applyReplyToComposer?: boolean
  }
) {
  await requestAgentCardPreviewEvent(proposalId, 'approved');
  const replyPayload = await fetchAgentCardPreviewReply(proposalId);

  if(options?.applyReplyToComposer && replyPayload.reply?.text) {
    putTextIntoCurrentComposer(replyPayload.reply.text);
  }

  return replyPayload;
}

export async function cancelAgentCardPreviewForCurrentChat(proposalId: string) {
  return requestAgentCardPreviewEvent(proposalId, 'cancelled');
}

export function focusCurrentAgentCardPreviewComposer() {
  const input = getCurrentComposerInput();
  if(!input) {
    throw new Error('compose input not found');
  }

  input.focus();
  placeCaretAtEnd(input);
}

export function sendCurrentAgentCardPreviewComposer() {
  const sendButton = document.querySelector('.btn-send');
  if(!(sendButton instanceof HTMLElement)) {
    throw new Error('send button not found');
  }

  sendButton.click();
}

function normalizeGatewayBaseUrl(value?: string) {
  if(!value) {
    return null;
  }

  const trimmedValue = value.trim().replace(/\/+$/, '');
  if(!trimmedValue) {
    return null;
  }

  if(trimmedValue.endsWith(PROPOSAL_PATH)) {
    return trimmedValue.slice(0, -PROPOSAL_PATH.length);
  }

  return trimmedValue;
}

function isLocalDevHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function readStoredRuntimeContext() {
  if(typeof window === 'undefined') {
    return undefined;
  }

  const contextFromWindow = (window as typeof window & {
    __agentCardPreviewRuntimeContext?: AgentCardPreviewRuntimeContext
  }).__agentCardPreviewRuntimeContext;
  if(contextFromWindow && typeof contextFromWindow === 'object') {
    return contextFromWindow;
  }

  try {
    const rawContext = window.localStorage.getItem(RUNTIME_CONTEXT_STORAGE_KEY);
    if(rawContext) {
      const parsedContext = JSON.parse(rawContext);
      if(parsedContext && typeof parsedContext === 'object') {
        return parsedContext as AgentCardPreviewRuntimeContext;
      }
    }
  } catch(err) {
    console.warn('Failed to parse Agent Card preview runtime context', err);
  }

  const kakaoId = window.localStorage.getItem(RUNTIME_KAKAO_ID_STORAGE_KEY)?.trim();
  if(kakaoId) {
    return {kakaoId};
  }

  return undefined;
}

function readWindowGatewayBaseUrl() {
  if(typeof window === 'undefined') {
    return null;
  }

  return normalizeGatewayBaseUrl((window as typeof window & {
    __agentCardPreviewGatewayBaseUrl?: string
  }).__agentCardPreviewGatewayBaseUrl);
}

function getCurrentChatContext() {
  const chat = getAppImManager()?.chat;
  if(!chat?.peerId) {
    return null;
  }

  return {
    peerId: chat.peerId,
    threadId: chat.threadId ?? null,
    monoforumThreadId: chat.monoforumThreadId ?? null
  };
}

function putTextIntoCurrentComposer(text: string) {
  const input = getCurrentComposerInput();
  if(!input) {
    throw new Error('compose input not found');
  }

  input.innerHTML = '';
  input.textContent = text;
  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    inputType: 'insertText',
    data: text
  }));
  focusCurrentAgentCardPreviewComposer();
}

function getAppImManager() {
  return (window as typeof window & {
    appImManager?: {
      chat?: {
        peerId?: number,
        threadId?: number | null,
        monoforumThreadId?: number | null
      }
    }
  }).appImManager;
}

function getCurrentComposerInput() {
  const input = document.querySelector('.input-message-input');
  return input instanceof HTMLElement ? input : null;
}

async function parseJsonResponse<T>(response: Response) {
  const rawText = await response.text();
  if(!rawText) {
    return {} as T;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch(err) {
    throw new Error(`Agent Card preview gateway returned invalid JSON: ${String(err)}`);
  }
}
