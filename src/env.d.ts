/* eslint-disable spaced-comment */
/// <reference types="vite/client" />
/// <reference types="vitest" />

interface ImportMetaEnv {
  readonly VITE_API_ID: string;
  readonly VITE_API_HASH: string;
  readonly VITE_VERSION: string;
  readonly VITE_VERSION_FULL: string;
  readonly VITE_BUILD: string;
  readonly VITE_MTPROTO_WORKER: string;
  readonly VITE_MTPROTO_SW: string;
  readonly VITE_MTPROTO_HTTP: string;
  readonly VITE_MTPROTO_HTTP_UPLOAD: string;
  readonly VITE_MTPROTO_AUTO: string;
  readonly VITE_MTPROTO_HAS_HTTP: string;
  readonly VITE_MTPROTO_HAS_WS: string;
  readonly VITE_MTPROTO_CUSTOM_WS_URL: string;
  readonly VITE_MTPROTO_CUSTOM_HTTP_URL: string;
  readonly VITE_MTPROTO_CUSTOM_RSA_PUBLIC_KEYS: string;
  readonly VITE_MTPROTO_BASE_DC_ID: string;
  readonly VITE_SAFARI_PROXY_WEBSOCKET: string;
  readonly VITE_AGENT_CARD_PREVIEW_GATEWAY_URL?: string;
  readonly VITE_AGENT_CARD_RUNTIME_KAKAO_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
